/**
 * AgentMesh - WebSocket Live Telemetry Server
 * Real-time event streaming for multi-agent thoughts, tool calls, and debate turns.
 */

import { WebSocketServer, WebSocket, RawData } from 'ws';
import { Server as HttpServer } from 'node:http';
import { SwarmOrchestrator } from '../swarm/swarm.js';
import { SwarmEvent } from '../types.js';

export class LiveTelemetryServer {
  private wss: WebSocketServer;
  private orchestrator: SwarmOrchestrator;
  private unsubscribeEvents?: () => void;

  constructor(server: HttpServer, orchestrator: SwarmOrchestrator) {
    this.orchestrator = orchestrator;
    this.wss = new WebSocketServer({ server, path: '/ws' });
    this.init();
  }

  private init(): void {
    this.wss.on('connection', (ws: WebSocket) => {
      // Send initial welcome & mesh state
      const initialPayload = {
        type: 'INIT_STATE',
        timestamp: Date.now(),
        metrics: this.orchestrator.getMetrics(),
        agents: this.orchestrator.getAllAgents().map((a) => a.persona),
        tools: this.orchestrator.getToolRegistry().getAllTools().map((t) => ({
          name: t.name,
          description: t.description,
          requiresApproval: t.requiresApproval || false,
          parameters: t.parameters,
        })),
        instances: this.orchestrator.getAllInstances(),
        pendingApprovals: this.orchestrator.getToolRegistry().getPendingApprovals(),
      };

      ws.send(JSON.stringify(initialPayload));

      ws.on('message', (message: RawData) => {
        try {
          const parsed = JSON.parse(message.toString());
          if (parsed.action === 'PING') {
            ws.send(JSON.stringify({ type: 'PONG', timestamp: Date.now() }));
          }
        } catch {
          // Ignore invalid messages
        }
      });
    });

    // Subscribe to swarm events
    this.unsubscribeEvents = this.orchestrator.subscribeEvents((event: SwarmEvent) => {
      this.broadcast({
        type: 'SWARM_EVENT',
        event,
        metrics: this.orchestrator.getMetrics(),
        pendingApprovals: this.orchestrator.getToolRegistry().getPendingApprovals(),
      });
    });
  }

  public broadcast(data: any): void {
    const payload = JSON.stringify(data);
    for (const client of this.wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(payload);
      }
    }
  }

  public close(): Promise<void> {
    if (this.unsubscribeEvents) {
      this.unsubscribeEvents();
    }
    return new Promise((resolve) => {
      this.wss.close(() => resolve());
    });
  }
}
