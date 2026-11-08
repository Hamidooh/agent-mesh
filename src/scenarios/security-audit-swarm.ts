/**
 * AgentMesh - Demo Swarm Scenarios
 * Pre-configured agent teams and real-world multi-agent goals.
 */

import { SwarmOrchestrator } from '../swarm/swarm.js';
import { Agent } from '../agent/agent.js';
import { BUILTIN_PERSONAS } from '../agent/persona.js';
import {
  KnowledgeRetrievalTool,
  MathEvaluatorTool,
  RemediationPatchTool,
  SecurityScannerTool,
} from '../tools/builtin-tools.js';
import { SwarmGoal } from '../types.js';

export function bootstrapDefaultSwarm(): SwarmOrchestrator {
  const orchestrator = new SwarmOrchestrator();
  const tools = orchestrator.getToolRegistry();
  const memory = orchestrator.getSharedMemory();

  // Register builtin tools
  tools.registerTool(SecurityScannerTool);
  tools.registerTool(MathEvaluatorTool);
  tools.registerTool(KnowledgeRetrievalTool);
  tools.registerTool(RemediationPatchTool);

  // Seed architectural knowledge into shared vector memory
  memory.add(
    'system',
    'Architectural Standard: Distributed swarms must validate external inputs and never pass unescaped variables to dynamic execution contexts.'
  );
  memory.add(
    'system',
    'Security Policy: All vulnerabilities classified as HIGH severity must be remediated before production sign-off.'
  );
  memory.add(
    'system',
    'Performance Directive: Critical payment and authentication pathways must maintain sub-100ms processing budgets.'
  );

  // Register agents
  orchestrator.registerAgent(new Agent(BUILTIN_PERSONAS.architect!, tools, memory));
  orchestrator.registerAgent(new Agent(BUILTIN_PERSONAS.auditor!, tools, memory));
  orchestrator.registerAgent(new Agent(BUILTIN_PERSONAS.perf_engineer!, tools, memory));
  orchestrator.registerAgent(new Agent(BUILTIN_PERSONAS.critic!, tools, memory));
  orchestrator.registerAgent(new Agent(BUILTIN_PERSONAS.judge!, tools, memory));

  return orchestrator;
}

export const DEMO_GOALS: Record<string, SwarmGoal> = {
  security_audit: {
    id: 'goal-security-audit',
    title: 'Audit Payment Gateway for SQL Injection & Prototype Flaws',
    description: 'Autonomous multi-agent review of payment authorization endpoints to find OWASP vulnerabilities and enforce defensive guardrails.',
    maxRounds: 4,
    requireConsensus: true,
  },
  perf_review: {
    id: 'goal-perf-review',
    title: 'Evaluate P95 Latency & Concurrency Bottlenecks',
    description: 'Multi-agent dialectic on caching strategies, worker pool semaphore sizing, and memory overhead under 10k req/sec load.',
    maxRounds: 3,
    requireConsensus: true,
  },
  incident_triage: {
    id: 'goal-incident-triage',
    title: 'Live Incident Triage & Emergency Patch Deliberation',
    description: 'Diagnose sudden latency spike on Auth Gateway, determine root cause, and formulate human-approved hotfix remediation.',
    maxRounds: 4,
    requireConsensus: true,
  },
};
