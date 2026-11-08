/**
 * AgentMesh - Autonomous Agent Runtime
 * Encapsulates persona, episodic vector memory, tool execution, and dialectic reasoning.
 */

import { randomUUID } from 'node:crypto';
import {
  AgentMessage,
  AgentPersona,
  AgentStatus,
  MessageType,
  ToolExecutionContext,
} from '../types.js';
import { VectorStore } from '../memory/vector-store.js';
import { ToolRegistry } from '../tools/tool-registry.js';

export interface AgentExecutionOptions {
  swarmId: string;
  signal?: AbortSignal;
  onEvent?: (message: AgentMessage) => void;
}

export class Agent {
  public readonly persona: AgentPersona;
  private status: AgentStatus = 'IDLE';
  private memory: VectorStore;
  private toolRegistry: ToolRegistry;
  private messageHistory: AgentMessage[] = [];

  constructor(
    persona: AgentPersona,
    toolRegistry: ToolRegistry,
    sharedMemory?: VectorStore
  ) {
    this.persona = persona;
    this.toolRegistry = toolRegistry;
    this.memory = sharedMemory || new VectorStore();
  }

  public get id(): string {
    return this.persona.id;
  }

  public get name(): string {
    return this.persona.name;
  }

  public getStatus(): AgentStatus {
    return this.status;
  }

  public setStatus(status: AgentStatus): void {
    this.status = status;
  }

  public getMemory(): VectorStore {
    return this.memory;
  }

  public getHistory(): AgentMessage[] {
    return this.messageHistory;
  }

  /**
   * Save an observation or reflection into the agent's vector memory.
   */
  public remember(text: string, metadata?: Record<string, any>): void {
    this.memory.add(this.id, text, metadata);
  }

  /**
   * Recall relevant experiences or knowledge based on semantic query.
   */
  public recall(query: string, topK: number = 2): string[] {
    const results = this.memory.search(query, topK, 0.05);
    return results.map((r) => r.entry.text);
  }

  /**
   * Execute an allowed tool with security validation.
   */
  public async callTool(
    toolName: string,
    args: Record<string, any>,
    options: AgentExecutionOptions
  ): Promise<any> {
    if (!this.persona.allowedTools.includes(toolName)) {
      throw new Error(
        `Agent "${this.persona.name}" does not have permission to invoke tool "${toolName}".`
      );
    }

    this.setStatus('TOOL_CALLING');

    const context: ToolExecutionContext = {
      agentId: this.id,
      swarmId: options.swarmId,
      signal: options.signal || new AbortController().signal,
      log: (_msg) => {
        // Log telemetry
      },
    };

    const record = await this.toolRegistry.executeTool(toolName, args, context);
    this.setStatus('THINKING');

    return record;
  }

  /**
   * Run a reasoning turn in response to incoming context or goal.
   */
  public async thinkAndAct(
    prompt: string,
    options: AgentExecutionOptions,
    messageType: MessageType = 'DEBATE_ARGUMENT',
    toAgentId: string = 'SWARM'
  ): Promise<AgentMessage> {
    this.setStatus('THINKING');

    // Recall relevant episodic context
    const recalledContext = this.recall(prompt, 2);

    // Simulate deliberate reasoning latency for realism
    await new Promise((r) => setTimeout(r, 200 + Math.random() * 250));

    // Construct agent thought message
    const message: AgentMessage = {
      id: randomUUID(),
      sequence: this.messageHistory.length + 1,
      timestamp: Date.now(),
      fromAgentId: this.id,
      fromAgentName: this.name,
      toAgentId,
      type: messageType,
      content: prompt,
      metadata: {
        role: this.persona.role,
        avatar: this.persona.avatar,
        color: this.persona.color,
        recalledContextCount: recalledContext.length,
      },
    };

    this.messageHistory.push(message);
    this.setStatus('RESPONDED');

    if (options.onEvent) {
      options.onEvent(message);
    }

    return message;
  }
}
