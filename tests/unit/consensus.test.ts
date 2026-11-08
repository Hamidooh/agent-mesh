import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ConsensusEvaluator } from '../../src/swarm/consensus.js';
import { AgentMessage } from '../../src/types.js';

describe('ConsensusEvaluator', () => {
  it('should detect agreement and return positive consensus', () => {
    const messages: AgentMessage[] = [
      { id: '1', sequence: 1, timestamp: Date.now(), fromAgentId: 'agent-1', fromAgentName: 'Agent 1', toAgentId: 'ALL', type: 'DEBATE_ARGUMENT', content: 'I agree with the security patch.' },
      { id: '2', sequence: 2, timestamp: Date.now(), fromAgentId: 'agent-2', fromAgentName: 'Agent 2', toAgentId: 'ALL', type: 'DEBATE_ARGUMENT', content: 'I concur, all tests pass.' },
    ];

    const verdict = ConsensusEvaluator.evaluate(messages, ['agent-1', 'agent-2']);
    assert.strictEqual(verdict.reached, true);
    assert.strictEqual(verdict.confidenceScore, 1.0);
    assert.strictEqual(verdict.dissentingAgents.length, 0);
  });

  it('should detect dissent when majority objects', () => {
    const messages: AgentMessage[] = [
      { id: '1', sequence: 1, timestamp: Date.now(), fromAgentId: 'agent-1', fromAgentName: 'Agent 1', toAgentId: 'ALL', type: 'DEBATE_ARGUMENT', content: 'I support this release.' },
      { id: '2', sequence: 2, timestamp: Date.now(), fromAgentId: 'agent-2', fromAgentName: 'Agent 2', toAgentId: 'ALL', type: 'DEBATE_ARGUMENT', content: 'I reject, security risk is too high.' },
      { id: '3', sequence: 3, timestamp: Date.now(), fromAgentId: 'agent-3', fromAgentName: 'Agent 3', toAgentId: 'ALL', type: 'DEBATE_ARGUMENT', content: 'I dissent due to unmitigated SQL injection.' },
    ];

    const verdict = ConsensusEvaluator.evaluate(messages, ['agent-1', 'agent-2', 'agent-3']);
    assert.strictEqual(verdict.reached, false);
    assert.ok(verdict.confidenceScore < 0.6);
    assert.strictEqual(verdict.dissentingAgents.length, 2);
  });
});
