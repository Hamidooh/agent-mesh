import { describe, it } from 'node:test';
import assert from 'node:assert';
import { Agent } from '../../src/agent/agent.js';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import { BUILTIN_PERSONAS } from '../../src/agent/persona.js';
import { MathEvaluatorTool } from '../../src/tools/builtin-tools.js';

describe('Agent Runtime & Memory', () => {
  it('should store and recall episodic memories', () => {
    const registry = new ToolRegistry();
    const agent = new Agent(BUILTIN_PERSONAS.architect!, registry);

    agent.remember('Zero-trust microservice boundary established.');
    agent.remember('Database replicas configured in 3 availability zones.');

    const recalled = agent.recall('zero trust security');
    assert.strictEqual(recalled.length > 0, true);
    assert.ok(recalled[0]?.includes('Zero-trust'));
  });

  it('should restrict tool execution to allowed tools only', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(MathEvaluatorTool);

    // Persona without math tool permissions
    const agent = new Agent(
      {
        id: 'restricted-agent',
        name: 'Restricted',
        role: 'specialist',
        avatar: '🔒',
        color: '#000',
        systemPrompt: 'Restricted agent',
        allowedTools: [], // No tools allowed
      },
      registry
    );

    await assert.rejects(
      async () => {
        await agent.callTool('math_evaluator', { expression: '2 + 2' }, { swarmId: 's1' });
      },
      /does not have permission to invoke tool/
    );
  });
});
