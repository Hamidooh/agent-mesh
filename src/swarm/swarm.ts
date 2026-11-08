/**
 * AgentMesh - Swarm Orchestrator Engine
 * Coordinates autonomous agent meshes, executes collaborative swarms, and streams events.
 */

import { randomUUID } from 'node:crypto';
import {
  SwarmEvent,
  SwarmEventType,
  SwarmGoal,
  SwarmInstance,
  SwarmMetrics,
  SwarmTopology,
} from '../types.js';
import { Agent } from '../agent/agent.js';
import { ToolRegistry } from '../tools/tool-registry.js';
import { VectorStore } from '../memory/vector-store.js';
import { SwarmRouter } from './router.js';
import { ConsensusEvaluator } from './consensus.js';
import { ReActController } from '../agent/react-loop.js';

export class SwarmOrchestrator {
  private agents: Map<string, Agent> = new Map();
  private instances: Map<string, SwarmInstance> = new Map();
  private toolRegistry: ToolRegistry;
  private sharedMemory: VectorStore;
  private abortControllers: Map<string, AbortController> = new Map();
  private eventSubscribers: Set<(event: SwarmEvent) => void> = new Set();
  private startTime: number = Date.now();
  private totalToolCallsCount: number = 0;
  private totalDebateTurnsCount: number = 0;

  constructor(toolRegistry?: ToolRegistry, sharedMemory?: VectorStore) {
    this.toolRegistry = toolRegistry || new ToolRegistry();
    this.sharedMemory = sharedMemory || new VectorStore();
  }

  public registerAgent(agent: Agent): void {
    this.agents.set(agent.id, agent);
  }

  public getAgent(id: string): Agent | undefined {
    return this.agents.get(id);
  }

  public getAllAgents(): Agent[] {
    return Array.from(this.agents.values());
  }

  public getToolRegistry(): ToolRegistry {
    return this.toolRegistry;
  }

  public getSharedMemory(): VectorStore {
    return this.sharedMemory;
  }

  public subscribeEvents(cb: (event: SwarmEvent) => void): () => void {
    this.eventSubscribers.add(cb);
    return () => this.eventSubscribers.delete(cb);
  }

  private emitEvent(swarmId: string, type: SwarmEventType, agentId?: string, payload?: any): void {
    const event: SwarmEvent = {
      id: randomUUID(),
      sequence: Date.now(),
      timestamp: Date.now(),
      swarmId,
      type,
      agentId,
      payload,
    };

    for (const sub of this.eventSubscribers) {
      try {
        sub(event);
      } catch {
        // Ignore subscriber errors
      }
    }
  }

  /**
   * Run a collaborative multi-agent swarm execution.
   */
  public async executeSwarm(
    goal: SwarmGoal,
    topology: SwarmTopology = 'COLLABORATIVE_DEBATE',
    customInstanceId?: string
  ): Promise<SwarmInstance> {
    const instanceId = customInstanceId || randomUUID();
    const abortController = new AbortController();
    this.abortControllers.set(instanceId, abortController);
    let wasCancelled = false;

    const instance: SwarmInstance = {
      id: instanceId,
      goal,
      topology,
      status: 'RUNNING',
      startTime: Date.now(),
      messages: [],
      toolInvocations: [],
    };

    this.instances.set(instanceId, instance);
    this.emitEvent(instanceId, 'SWARM_STARTED', undefined, { goal, topology });

    const maxRounds = goal.maxRounds || 4;
    let currentRound = 0;

    try {
      while (currentRound < maxRounds) {
        if (abortController.signal.aborted) {
          wasCancelled = true;
          throw new Error('Swarm execution was cancelled by user.');
        }

        currentRound++;
        const participatingAgents = Array.from(this.agents.values());

        const turnPlan = SwarmRouter.planNextTurn(
          topology,
          participatingAgents,
          goal,
          instance.messages,
          currentRound,
          maxRounds
        );

        if (!turnPlan) {
          break;
        }

        const agent = turnPlan.currentAgent;
        instance.activeAgentId = agent.id;
        this.emitEvent(instanceId, 'AGENT_THINKING', agent.id, { round: currentRound });

        // If agent has tools, run a ReAct execution loop
        if (agent.persona.allowedTools.length > 0) {
          const react = new ReActController(agent);
          const reactOutcome = await react.executeTask(
            goal.title,
            async (toolName, args) => {
              const res = await agent.callTool(toolName, args, {
                swarmId: instanceId,
                signal: abortController.signal,
              });
              this.totalToolCallsCount++;
              instance.toolInvocations.push(res);
              this.emitEvent(instanceId, 'TOOL_INVOKED', agent.id, res);
              return res;
            },
            {
              swarmId: instanceId,
              signal: abortController.signal,
            }
          );

          // Emit synthesized findings from the agent
          await agent.thinkAndAct(
            `${turnPlan.suggestedPrompt}\n\nKey Findings: ${reactOutcome.finalAnswer}`,
            {
              swarmId: instanceId,
              signal: abortController.signal,
              onEvent: (msg) => {
                instance.messages.push(msg);
                this.totalDebateTurnsCount++;
                this.emitEvent(instanceId, 'AGENT_MESSAGE', agent.id, msg);
              },
            },
            'DEBATE_ARGUMENT',
            turnPlan.targetRecipient
          );
        } else {
          // Pure dialectic debate turn or final synthesis
          const msgType = turnPlan.isFinalTurn ? 'FINAL_SYNTHESIS' : 'DEBATE_ARGUMENT';
          const synthesisPrompt = turnPlan.isFinalTurn
            ? `Final Executive Decision: Synthesizing ${instance.messages.length} rounds of discussion. Strategy approved with safeguards.`
            : turnPlan.suggestedPrompt;

          await agent.thinkAndAct(
            synthesisPrompt,
            {
              swarmId: instanceId,
              signal: abortController.signal,
              onEvent: (msg) => {
                instance.messages.push(msg);
                this.totalDebateTurnsCount++;
                this.emitEvent(instanceId, 'AGENT_MESSAGE', agent.id, msg);
              },
            },
            msgType,
            turnPlan.targetRecipient
          );
        }

        // Brief inter-turn cadence
        await new Promise((r) => setTimeout(r, 150));
      }

      // Conclude with consensus evaluation
      const verdict = ConsensusEvaluator.evaluate(
        instance.messages,
        Array.from(this.agents.keys())
      );

      instance.verdict = verdict;
      instance.status = verdict.reached ? 'CONSENSUS_REACHED' : 'COMPLETED';
      instance.endTime = Date.now();
      instance.durationMs = instance.endTime - instance.startTime;
      instance.activeAgentId = undefined;

      this.emitEvent(instanceId, 'CONSENSUS_EVALUATED', undefined, verdict);
      this.emitEvent(instanceId, 'SWARM_COMPLETED', undefined, instance);

      return instance;
    } catch (err: any) {
      instance.status = wasCancelled ? 'CANCELLED' : 'FAILED';
      instance.error = err.message || String(err);
      instance.endTime = Date.now();
      instance.durationMs = instance.endTime - instance.startTime;
      instance.activeAgentId = undefined;

      this.emitEvent(
        instanceId,
        wasCancelled ? 'SWARM_CANCELLED' : 'SWARM_FAILED',
        undefined,
        { error: instance.error }
      );

      return instance;
    } finally {
      this.abortControllers.delete(instanceId);
      // Reset agent statuses
      for (const a of this.agents.values()) {
        a.setStatus('IDLE');
      }
    }
  }

  public cancelSwarm(instanceId: string): boolean {
    const controller = this.abortControllers.get(instanceId);
    if (!controller) return false;
    controller.abort();
    return true;
  }

  public getInstance(id: string): SwarmInstance | undefined {
    return this.instances.get(id);
  }

  public getAllInstances(): SwarmInstance[] {
    return Array.from(this.instances.values());
  }

  public getMetrics(): SwarmMetrics {
    const total = this.instances.size;
    const completed = Array.from(this.instances.values()).filter(
      (i) => i.status === 'COMPLETED' || i.status === 'CONSENSUS_REACHED'
    ).length;
    const consensusCount = Array.from(this.instances.values()).filter(
      (i) => i.verdict?.reached
    ).length;

    const durations = Array.from(this.instances.values())
      .map((i) => i.durationMs)
      .filter((d): d is number => typeof d === 'number');

    const avgDuration = durations.length > 0
      ? Math.round(durations.reduce((a, b) => a + b, 0) / durations.length)
      : 0;

    return {
      totalGoalsExecuted: total,
      activeSwarms: this.abortControllers.size,
      successfulSwarms: completed,
      totalToolCalls: this.totalToolCallsCount,
      totalDebateTurns: this.totalDebateTurnsCount,
      averageSwarmDurationMs: avgDuration,
      consensusRate: total > 0 ? Math.round((consensusCount / total) * 100) : 100,
      uptimeSeconds: Math.floor((Date.now() - this.startTime) / 1000),
    };
  }
}
