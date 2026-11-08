/**
 * AgentMesh - HTTP REST API & Static Visualizer Server
 * Complete REST API with async safety guards and static asset streaming.
 */

import * as http from 'node:http';
import * as fs from 'node:fs';
import * as path from 'node:path';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { SwarmOrchestrator } from '../swarm/swarm.js';
import { LiveTelemetryServer } from './ws-server.js';
import { DEMO_GOALS } from '../scenarios/security-audit-swarm.js';
import { SwarmGoal, SwarmTopology } from '../types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ServerOptions {
  port?: number;
  host?: string;
  orchestrator: SwarmOrchestrator;
}

export class AgentMeshServer {
  private server: http.Server;
  private wsServer: LiveTelemetryServer;
  private readonly orchestrator: SwarmOrchestrator;
  private readonly port: number;
  private readonly host: string;

  constructor(options: ServerOptions) {
    this.orchestrator = options.orchestrator;
    this.port = options.port ?? 3040;
    this.host = options.host ?? '0.0.0.0';

    // Wrap async handler so uncaught promise rejections never crash the process
    this.server = http.createServer((req, res) => {
      this.handleRequest(req, res).catch((err) => {
        console.error('[AgentMeshServer] Unhandled request error:', err);
        if (!res.headersSent) {
          res.writeHead(500, { 'Content-Type': 'application/json' });
        }
        if (!res.writableEnded) {
          res.end(JSON.stringify({ error: 'Internal Server Error' }));
        }
      });
    });

    this.wsServer = new LiveTelemetryServer(this.server, this.orchestrator);
  }

  private async handleRequest(req: http.IncomingMessage, res: http.ServerResponse): Promise<void> {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
      res.writeHead(204);
      res.end();
      return;
    }

    const parsedUrl = new URL(req.url ?? '/', `http://${req.headers.host || 'localhost'}`);
    const pathname = parsedUrl.pathname;

    try {
      // 1. Health
      if (req.method === 'GET' && pathname === '/api/health') {
        return this.sendJson(res, 200, {
          status: 'UP',
          service: 'AgentMesh Swarm Engine',
          version: '1.0.0',
          uptime: process.uptime(),
          memoryUsage: process.memoryUsage(),
        });
      }

      // 2. Metrics
      if (req.method === 'GET' && pathname === '/api/metrics') {
        return this.sendJson(res, 200, this.orchestrator.getMetrics());
      }

      // 3. List Agents
      if (req.method === 'GET' && pathname === '/api/agents') {
        return this.sendJson(res, 200, {
          agents: this.orchestrator.getAllAgents().map((a) => a.persona),
        });
      }

      // 4. List Tools
      if (req.method === 'GET' && pathname === '/api/tools') {
        return this.sendJson(res, 200, {
          tools: this.orchestrator.getToolRegistry().getAllTools().map((t) => ({
            name: t.name,
            description: t.description,
            requiresApproval: t.requiresApproval || false,
            parameters: t.parameters,
          })),
        });
      }

      // 5. Memory Query
      if (req.method === 'GET' && pathname === '/api/memory') {
        const query = parsedUrl.searchParams.get('q');
        if (query) {
          const results = this.orchestrator.getSharedMemory().search(query, 5);
          return this.sendJson(res, 200, { query, results });
        }
        return this.sendJson(res, 200, {
          totalEntries: this.orchestrator.getSharedMemory().count(),
          entries: this.orchestrator.getSharedMemory().getAllEntries(),
        });
      }

      // 6. Pre-configured Goals
      if (req.method === 'GET' && pathname === '/api/goals') {
        return this.sendJson(res, 200, { goals: Object.values(DEMO_GOALS) });
      }

      // 7. Trigger Swarm Run: POST /api/swarms/run
      if (req.method === 'POST' && pathname === '/api/swarms/run') {
        const body = await this.readJsonBody(req);
        const goal: SwarmGoal = body.goal || DEMO_GOALS.security_audit;
        const topology: SwarmTopology = body.topology || 'COLLABORATIVE_DEBATE';
        const isSync = parsedUrl.searchParams.get('sync') === 'true';
        const instanceId = randomUUID();

        if (isSync) {
          const instance = await this.orchestrator.executeSwarm(goal, topology, instanceId);
          return this.sendJson(res, 200, instance);
        } else {
          // Fire and forget with deterministic instanceId
          const runPromise = this.orchestrator.executeSwarm(goal, topology, instanceId);
          runPromise.catch((err: Error) => {
            console.error(`[Server] Background swarm error [${instanceId}]:`, err.message);
          });

          return this.sendJson(res, 202, {
            message: 'Swarm execution accepted',
            instanceId,
            goalTitle: goal.title,
            topology,
          });
        }
      }

      // 8. List Swarm Instances: GET /api/swarms
      if (req.method === 'GET' && pathname === '/api/swarms') {
        return this.sendJson(res, 200, { instances: this.orchestrator.getAllInstances() });
      }

      // 9. Get Specific Swarm: GET /api/swarms/:id
      const swarmMatch = pathname.match(/^\/api\/swarms\/([^/]+)$/);
      if (req.method === 'GET' && swarmMatch) {
        const instanceId = decodeURIComponent(swarmMatch[1]!);
        const instance = this.orchestrator.getInstance(instanceId);
        if (!instance) {
          return this.sendJson(res, 404, { error: `Swarm instance "${instanceId}" not found` });
        }
        return this.sendJson(res, 200, instance);
      }

      // 10. Cancel Swarm: POST /api/swarms/:id/cancel
      const cancelMatch = pathname.match(/^\/api\/swarms\/([^/]+)\/cancel$/);
      if (req.method === 'POST' && cancelMatch) {
        const instanceId = decodeURIComponent(cancelMatch[1]!);
        const success = this.orchestrator.cancelSwarm(instanceId);
        return this.sendJson(res, success ? 200 : 400, { success, instanceId });
      }

      // 11. Human Approval: POST /api/approvals/:id
      const approvalMatch = pathname.match(/^\/api\/approvals\/([^/]+)$/);
      if (req.method === 'POST' && approvalMatch) {
        const executionId = decodeURIComponent(approvalMatch[1]!);
        const body = await this.readJsonBody(req);
        const approved = Boolean(body.approved);
        const success = this.orchestrator.getToolRegistry().resolveApproval(executionId, approved);
        return this.sendJson(res, success ? 200 : 404, { success, executionId, approved });
      }

      // 12. Serve Static Web Visualizer Dashboard
      if (req.method === 'GET') {
        const served = await this.serveStaticUI(pathname, res);
        if (served) return;
      }

      return this.sendJson(res, 404, { error: 'Not Found' });
    } catch (err: any) {
      console.error('[AgentMeshServer] Request Error:', err);
      return this.sendJson(res, 500, { error: err.message ?? 'Internal Server Error' });
    }
  }

  private async serveStaticUI(pathname: string, res: http.ServerResponse): Promise<boolean> {
    let cleanPath = pathname === '/' ? '/index.html' : pathname;
    if (cleanPath.startsWith('/ui/')) {
      cleanPath = cleanPath.slice(3);
    }

    const possibleDirs = [
      path.join(process.cwd(), 'src', 'ui'),
      path.join(process.cwd(), 'dist', 'ui'),
      path.join(__dirname, '..', 'ui'),
    ];

    let filePath: string | null = null;
    for (const dir of possibleDirs) {
      const candidate = path.join(dir, cleanPath);
      if (fs.existsSync(candidate) && fs.statSync(candidate).isFile()) {
        filePath = candidate;
        break;
      }
    }

    if (!filePath) {
      return false;
    }

    const ext = path.extname(filePath).toLowerCase();
    const mimeTypes: Record<string, string> = {
      '.html': 'text/html; charset=utf-8',
      '.css': 'text/css; charset=utf-8',
      '.js': 'application/javascript; charset=utf-8',
      '.json': 'application/json; charset=utf-8',
      '.svg': 'image/svg+xml',
      '.png': 'image/png',
    };

    const contentType = mimeTypes[ext] || 'text/plain';
    const content = await fs.promises.readFile(filePath);
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
    return true;
  }

  private async readJsonBody(req: http.IncomingMessage): Promise<any> {
    return new Promise((resolve, reject) => {
      let data = '';
      let rejected = false;
      req.on('data', (chunk) => {
        data += chunk;
        if (data.length > 5 * 1024 * 1024 && !rejected) {
          rejected = true;
          req.destroy();
          reject(new Error('Request payload too large'));
        }
      });
      req.on('end', () => {
        if (!data.trim()) return resolve({});
        try {
          resolve(JSON.parse(data));
        } catch {
          reject(new Error('Invalid JSON payload'));
        }
      });
      req.on('error', reject);
    });
  }

  private sendJson(res: http.ServerResponse, statusCode: number, data: any): void {
    res.writeHead(statusCode, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(data, null, 2));
  }

  public async start(): Promise<void> {
    return new Promise((resolve) => {
      this.server.listen(this.port, this.host, () => {
        resolve();
      });
    });
  }

  public async stop(): Promise<void> {
    if (this.wsServer) {
      await this.wsServer.close();
    }
    return new Promise((resolve) => {
      this.server.close(() => resolve());
    });
  }
}
