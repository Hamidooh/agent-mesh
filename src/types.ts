/**
 * AgentMesh - Core Type Definitions
 * Autonomous Multi-Agent Swarm Orchestrator & Task Mesh
 */

export type AgentRole =
  | 'orchestrator'
  | 'architect'
  | 'planner'
  | 'researcher'
  | 'auditor'
  | 'critic'
  | 'engineer'
  | 'judge'
  | 'evaluator'
  | 'specialist';

export type AgentStatus =
  | 'IDLE'
  | 'THINKING'
  | 'TOOL_CALLING'
  | 'WAITING_APPROVAL'
  | 'RESPONDED'
  | 'ERROR';

export interface AgentPersona {
  id: string;
  name: string;
  role: AgentRole;
  avatar: string;
  color: string;
  systemPrompt: string;
  temperature?: number;
  allowedTools: string[];
}

export type MessageType =
  | 'TASK_DISPATCH'
  | 'THOUGHT'
  | 'TOOL_CALL'
  | 'TOOL_RESULT'
  | 'DEBATE_ARGUMENT'
  | 'CRITIQUE'
  | 'CONSENSUS_VOTE'
  | 'FINAL_SYNTHESIS'
  | 'SYSTEM_ALERT';

export interface AgentMessage {
  id: string;
  sequence: number;
  timestamp: number;
  fromAgentId: string;
  fromAgentName: string;
  toAgentId: string; // Specific agent ID or 'SWARM' / 'BROADCAST'
  type: MessageType;
  content: string;
  metadata?: Record<string, any>;
}

export interface ToolParamSchema {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  description: string;
  required?: boolean;
  enum?: string[];
}

export interface ToolExecutionContext {
  agentId: string;
  swarmId: string;
  signal: AbortSignal;
  log: (msg: string, data?: any) => void;
}

export interface ToolDefinition<TArgs = Record<string, any>, TResult = any> {
  name: string;
  description: string;
  requiresApproval?: boolean;
  parameters: Record<string, ToolParamSchema>;
  execute: (args: TArgs, context: ToolExecutionContext) => Promise<TResult>;
}

export interface ToolExecutionRecord {
  id: string;
  toolName: string;
  agentId: string;
  args: Record<string, any>;
  output?: any;
  error?: string;
  durationMs: number;
  approved: boolean;
  timestamp: number;
}

export interface ReActStep {
  stepNumber: number;
  thought: string;
  toolCall?: {
    toolName: string;
    args: Record<string, any>;
  };
  observation?: any;
  reflection?: string;
  timestamp: number;
}

export interface MemoryEntry {
  id: string;
  agentId: string;
  text: string;
  vector: number[];
  metadata?: Record<string, any>;
  timestamp: number;
}

export interface MemorySearchResult {
  entry: MemoryEntry;
  similarity: number;
}

export type SwarmTopology =
  | 'HIERARCHICAL'        // Leader delegates to specialists, then synthesizes
  | 'COLLABORATIVE_DEBATE' // Multi-round dialectic between opposing viewpoints
  | 'ROUND_ROBIN'         // Sequential peer-to-peer relay
  | 'VOTING_CONSENSUS';   // Simultaneous deliberation with majority voting

export type SwarmStatus =
  | 'IDLE'
  | 'RUNNING'
  | 'WAITING_HUMAN'
  | 'CONSENSUS_REACHED'
  | 'COMPLETED'
  | 'FAILED'
  | 'CANCELLED';

export interface ConsensusVerdict {
  reached: boolean;
  confidenceScore: number; // 0.0 to 1.0
  supportingAgents: string[];
  dissentingAgents: string[];
  synthesis: string;
}

export interface SwarmGoal {
  id: string;
  title: string;
  description: string;
  context?: Record<string, any>;
  maxRounds?: number;
  requireConsensus?: boolean;
}

export interface SwarmInstance {
  id: string;
  goal: SwarmGoal;
  topology: SwarmTopology;
  status: SwarmStatus;
  startTime: number;
  endTime?: number;
  durationMs?: number;
  activeAgentId?: string;
  messages: AgentMessage[];
  toolInvocations: ToolExecutionRecord[];
  verdict?: ConsensusVerdict;
  error?: string;
}

export interface SwarmMetrics {
  totalGoalsExecuted: number;
  activeSwarms: number;
  successfulSwarms: number;
  totalToolCalls: number;
  totalDebateTurns: number;
  averageSwarmDurationMs: number;
  consensusRate: number;
  uptimeSeconds: number;
}

export type SwarmEventType =
  | 'SWARM_STARTED'
  | 'SWARM_COMPLETED'
  | 'SWARM_FAILED'
  | 'SWARM_CANCELLED'
  | 'AGENT_THINKING'
  | 'AGENT_MESSAGE'
  | 'TOOL_INVOKED'
  | 'TOOL_APPROVED'
  | 'CONSENSUS_EVALUATED'
  | 'METRICS_UPDATED';

export interface SwarmEvent {
  id: string;
  sequence: number;
  timestamp: number;
  swarmId: string;
  type: SwarmEventType;
  agentId?: string;
  payload?: any;
}
