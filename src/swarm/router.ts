/**
 * AgentMesh - Swarm Message Router & Turn Coordinator
 * Implements Hierarchical, Collaborative Debate, Voting Consensus, and Round-Robin topologies.
 */

import { Agent } from '../agent/agent.js';
import { AgentMessage, SwarmGoal, SwarmTopology } from '../types.js';

export interface RouteTurnPlan {
  currentAgent: Agent;
  targetRecipient: string;
  suggestedPrompt: string;
  isFinalTurn: boolean;
}

export class SwarmRouter {
  public static planNextTurn(
    topology: SwarmTopology,
    agents: Agent[],
    goal: SwarmGoal,
    history: AgentMessage[],
    round: number,
    maxRounds: number
  ): RouteTurnPlan | null {
    if (agents.length === 0) return null;
    const isLastRound = round >= maxRounds;

    switch (topology) {
      case 'HIERARCHICAL': {
        // Round 1: Orchestrator/Planner breaks down task
        if (history.length === 0) {
          const leader = agents.find((a) => a.persona.role === 'architect' || a.persona.role === 'planner') || agents[0]!;
          return {
            currentAgent: leader,
            targetRecipient: 'SWARM',
            suggestedPrompt: `Decompose strategic goal: "${goal.title}" into specialist tasks.`,
            isFinalTurn: false,
          };
        }

        // Middle rounds: Specialists execute tasks
        const nonLeaders = agents.filter((a) => a.persona.role !== 'architect' && a.persona.role !== 'judge');
        const specialistIdx = (round - 1) % (nonLeaders.length || 1);
        const specialist = nonLeaders[specialistIdx] || agents[1] || agents[0]!;

        if (!isLastRound) {
          return {
            currentAgent: specialist,
            targetRecipient: 'agent-architect',
            suggestedPrompt: `Execute specialist investigation for goal "${goal.title}" and report findings.`,
            isFinalTurn: false,
          };
        }

        // Final round: Judge/Synthesizer formulates conclusion
        const judge = agents.find((a) => a.persona.role === 'judge') || agents[0]!;
        return {
          currentAgent: judge,
          targetRecipient: 'ALL',
          suggestedPrompt: `Synthesize all specialist findings into executive decision for "${goal.title}".`,
          isFinalTurn: true,
        };
      }

      case 'COLLABORATIVE_DEBATE': {
        // Alternates between Proponent and Critic, concludes with Judge
        const debaters = agents.filter((a) => a.persona.role !== 'judge');
        const activeDebater = debaters[round % (debaters.length || 1)] || agents[0]!;

        if (!isLastRound) {
          const rolePrompt = activeDebater.persona.role === 'critic'
            ? `Identify potential security risks, false assumptions, and flaws in the current proposal.`
            : `Present architecture proposal, defending safety and performance merits.`;

          return {
            currentAgent: activeDebater,
            targetRecipient: 'SWARM',
            suggestedPrompt: `${rolePrompt} Topic: "${goal.title}".`,
            isFinalTurn: false,
          };
        }

        const judge = agents.find((a) => a.persona.role === 'judge') || agents[agents.length - 1]!;
        return {
          currentAgent: judge,
          targetRecipient: 'ALL',
          suggestedPrompt: `Evaluate debate arguments and rule on final consensus verdict for "${goal.title}".`,
          isFinalTurn: true,
        };
      }

      case 'VOTING_CONSENSUS': {
        const agentIdx = (round - 1) % agents.length;
        const agent = agents[agentIdx] || agents[0]!;
        return {
          currentAgent: agent,
          targetRecipient: 'SWARM',
          suggestedPrompt: `Deliberate and cast vote on whether to approve: "${goal.title}".`,
          isFinalTurn: round >= agents.length,
        };
      }

      case 'ROUND_ROBIN':
      default: {
        const agentIdx = (round - 1) % agents.length;
        const currentAgent = agents[agentIdx] || agents[0]!;
        const nextAgent = agents[(agentIdx + 1) % agents.length]!;

        return {
          currentAgent,
          targetRecipient: nextAgent.id,
          suggestedPrompt: `Process and hand over work for: "${goal.title}".`,
          isFinalTurn: isLastRound,
        };
      }
    }
  }
}
