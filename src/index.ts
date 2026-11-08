/**
 * AgentMesh - Library Entry Point
 * Autonomous Multi-Agent Swarm Orchestrator & Task Mesh
 */

export * from './types.js';
export { SwarmOrchestrator } from './swarm/swarm.js';
export { SwarmRouter } from './swarm/router.js';
export { ConsensusEvaluator } from './swarm/consensus.js';
export { Agent } from './agent/agent.js';
export type { AgentExecutionOptions } from './agent/agent.js';
export { ReActController } from './agent/react-loop.js';
export type { ReActLoopConfig } from './agent/react-loop.js';
export { BUILTIN_PERSONAS } from './agent/persona.js';
export { VectorStore } from './memory/vector-store.js';
export { ToolRegistry } from './tools/tool-registry.js';
export {
  SecurityScannerTool,
  MathEvaluatorTool,
  KnowledgeRetrievalTool,
  RemediationPatchTool,
} from './tools/builtin-tools.js';
export { bootstrapDefaultSwarm, DEMO_GOALS } from './scenarios/security-audit-swarm.js';
export { AgentMeshServer } from './server/http-server.js';
export type { ServerOptions } from './server/http-server.js';
