import { describe, it } from 'node:test';
import assert from 'node:assert';
import { ToolRegistry } from '../../src/tools/tool-registry.js';
import { MathEvaluatorTool, SecurityScannerTool } from '../../src/tools/builtin-tools.js';

describe('ToolRegistry & Parameter Validation', () => {
  it('should register tools and validate parameter schema', () => {
    const registry = new ToolRegistry();
    registry.registerTool(MathEvaluatorTool);

    const valid = registry.validateArgs(MathEvaluatorTool, { expression: '10 * 25' });
    assert.strictEqual(valid.valid, true);

    const invalid = registry.validateArgs(MathEvaluatorTool, {});
    assert.strictEqual(invalid.valid, false);
    assert.ok(invalid.errors[0]?.includes('Missing required parameter'));
  });

  it('should execute registered tools sandboxed without crashing', async () => {
    const registry = new ToolRegistry();
    registry.registerTool(SecurityScannerTool);

    const res = await registry.executeTool(
      'security_scanner',
      { codeSnippet: 'const x = eval("test");', language: 'javascript' },
      { agentId: 'test-agent', swarmId: 'test-swarm', signal: new AbortController().signal, log: () => {} }
    );

    assert.strictEqual(res.approved, true);
    assert.strictEqual(res.output.status, 'VULNERABILITIES_FOUND');
    assert.ok(res.output.riskScore > 0);
  });

  it('should pause and require approval for high-stakes tools', async () => {
    const registry = new ToolRegistry();
    registry.registerTool({
      name: 'critical_action',
      description: 'Requires approval',
      requiresApproval: true,
      parameters: {},
      execute: async () => 'action_executed',
    });

    let pendingId = '';
    const promise = registry.executeTool(
      'critical_action',
      {},
      { agentId: 'a1', swarmId: 's1', signal: new AbortController().signal, log: () => {} }
    );

    await new Promise((r) => setTimeout(r, 20));
    const pending = registry.getPendingApprovals();
    assert.strictEqual(pending.length, 1);
    pendingId = pending[0]?.id!;

    // Resolve approval
    registry.resolveApproval(pendingId, true);
    const result = await promise;
    assert.strictEqual(result.approved, true);
    assert.strictEqual(result.output, 'action_executed');
  });
});
