---
name: agentmesh-swarm
description: >-
  Expert guide, runbook, and architectural cheatsheet for designing, building,
  executing, and debugging autonomous multi-agent swarms, dialectic debates,
  ReAct tool loops, and episodic vector memory with the AgentMesh Engine.
  Use when orchestrating multi-agent collaboration, creating specialized agent personas,
  defining sandboxed tools, or integrating with the AgentMesh REST & WebSocket APIs.
---

# AgentMesh Engine — Agent Skill & Multi-Agent Swarm Guide

AgentMesh is a lightweight, zero-dependency (Node.js native + `ws`) multi-agent swarm orchestrator and autonomous task mesh runtime. It provides hierarchical routing, dialectic debate synthesis, ReAct reflection loops with cycle guards, in-memory TF-IDF vector memory, and human-in-the-loop (HITL) tool sandboxing.

---

## 1. Engine Core Concepts

### Multi-Agent Topologies
* **COLLABORATIVE_DEBATE:** Alternating dialectic rounds between proposing and criticizing agents, concluding with an executive judge.
* **HIERARCHICAL:** Planner agent decomposes strategic goals into specialist tasks; evaluators synthesize findings.
* **VOTING_CONSENSUS:** Concurrent independent evaluations with mathematical confidence scoring.
* **ROUND_ROBIN:** Ordered peer-to-peer relay.

### ReAct Loop & Guardrails
* **Reasoning Cycle:** Reason $\rightarrow$ Act (Tool Call) $\rightarrow$ Observe $\rightarrow$ Reflect $\rightarrow$ Conclude.
* **Cycle Guard:** Prevents infinite repeating tool calls by hashing `toolName:argsJSON`.
* **Human-in-the-Loop (HITL):** High-stakes actions require human operator sign-off before proceeding.

### Episodic Vector Memory
* **Zero-Dependency Vector Store:** In-memory TF-IDF projection + Cosine similarity ranking without external databases.

---

## 2. Defining Custom Agent Personas

```typescript
import { AgentPersona } from 'agentmesh-swarm';

export const MySpecialistPersona: AgentPersona = {
  id: 'agent-compliance',
  name: 'Justus (Compliance Officer)',
  role: 'auditor',
  avatar: '📋',
  color: '#10b981',
  systemPrompt: 'You enforce GDPR and HIPAA data boundary protections across microservices.',
  allowedTools: ['knowledge_search', 'security_scanner'],
};
```

---

## 3. Registering Sandboxed Tools

```typescript
import { ToolDefinition } from 'agentmesh-swarm';

export const CustomAPITool: ToolDefinition<{ endpoint: string }> = {
  name: 'ping_service',
  description: 'Pings an internal service endpoint for health status',
  requiresApproval: false,
  parameters: {
    endpoint: {
      type: 'string',
      description: 'The URL or service hostname to check',
      required: true,
    },
  },
  execute: async ({ endpoint }, ctx) => {
    ctx.log(`Pinging service endpoint: ${endpoint}`);
    return { status: 'HEALTHY', latencyMs: 12 };
  },
};
```

---

## 4. Programmatic Swarm Deliberation Runbook

```typescript
import { bootstrapDefaultSwarm, SwarmGoal } from 'agentmesh-swarm';

const orchestrator = bootstrapDefaultSwarm();

const goal: SwarmGoal = {
  id: 'arch-review-01',
  title: 'Evaluate Distributed Event Sourcing vs CDC',
  description: 'Debate trade-offs between append-only event sourcing and database change-data-capture.',
  maxRounds: 3,
  requireConsensus: true,
};

// Execute debate swarm
const instance = await orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE');

console.log(`Swarm Status: ${instance.status}`);
console.log(`Verdict:      ${instance.verdict?.synthesis}`);
console.log(`Confidence:   ${instance.verdict?.confidenceScore}`);
```

---

## 5. REST API & WebSocket Reference

Server defaults to port `3040` (`http://localhost:3040`).

### REST Endpoints
* `GET /api/health` — Service health & uptime.
* `GET /api/metrics` — Swarm throughput, active swarms, consensus rate.
* `GET /api/agents` — List registered agent personas and tool permissions.
* `GET /api/tools` — List registered tools in the mesh.
* `GET /api/memory?q=<query>` — Semantic vector memory search.
* `POST /api/swarms/run` — Trigger swarm run (`?sync=true` supported).
* `GET /api/swarms/:id` — Inspect full multi-agent transcript and consensus.
* `POST /api/swarms/:id/cancel` — Abort active swarm execution.
* `POST /api/approvals/:id` — Approve or reject pending HITL actions (`{ approved: true/false }`).
