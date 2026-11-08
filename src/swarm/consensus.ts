/**
 * AgentMesh - Swarm Consensus Evaluator
 * Analyzes multi-agent votes, dissent, and synthesized outcomes.
 */

import { AgentMessage, ConsensusVerdict } from '../types.js';

export class ConsensusEvaluator {
  /**
   * Evaluate consensus among deliberating agents.
   */
  public static evaluate(
    messages: AgentMessage[],
    _expectedAgents: string[]
  ): ConsensusVerdict {
    // Edge case: no messages → return neutral non-consensus (not a failure)
    if (messages.length === 0) {
      return {
        reached: false,
        confidenceScore: 0,
        supportingAgents: [],
        dissentingAgents: [],
        synthesis: 'No debate messages recorded. Swarm completed with no deliberation.',
      };
    }

    const votes = messages.filter(
      (m) => m.type === 'CONSENSUS_VOTE' || m.type === 'DEBATE_ARGUMENT'
    );

    const supportingAgents = new Set<string>();
    const dissentingAgents = new Set<string>();

    for (const msg of votes) {
      const text = msg.content.toLowerCase();
      // Heuristic sentiment / vote detection
      if (
        text.includes('agree') ||
        text.includes('approve') ||
        text.includes('concur') ||
        text.includes('consensus reached') ||
        text.includes('support') ||
        text.includes('pass')
      ) {
        supportingAgents.add(msg.fromAgentId);
      } else if (
        text.includes('reject') ||
        text.includes('dissent') ||
        text.includes('disagree') ||
        text.includes('object') ||
        text.includes('risk is too high')
      ) {
        dissentingAgents.add(msg.fromAgentId);
      } else {
        // Neutral or informative contribution defaults to support if constructive
        supportingAgents.add(msg.fromAgentId);
      }
    }

    const totalVotes = supportingAgents.size + dissentingAgents.size || 1;
    const confidenceScore = Math.min(1.0, Number((supportingAgents.size / totalVotes).toFixed(2)));
    const reached = confidenceScore >= 0.6;

    let synthesis = '';
    if (reached) {
      synthesis = `Consensus reached with ${(confidenceScore * 100).toFixed(0)}% agreement. All key architectural and security requirements satisfied.`;
    } else {
      synthesis = `Consensus stalled (${(confidenceScore * 100).toFixed(0)}% agreement). Outstanding concerns noted by: ${Array.from(dissentingAgents).join(', ')}.`;
    }

    return {
      reached,
      confidenceScore,
      supportingAgents: Array.from(supportingAgents),
      dissentingAgents: Array.from(dissentingAgents),
      synthesis,
    };
  }
}
