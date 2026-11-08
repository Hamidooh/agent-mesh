import { describe, it } from 'node:test';
import assert from 'node:assert';
import { bootstrapDefaultSwarm, DEMO_GOALS } from '../../src/index.js';

describe('SwarmOrchestrator Integration', () => {
  it('should execute collaborative debate swarm and reach consensus verdict', async () => {
    const orchestrator = bootstrapDefaultSwarm();
    const goal = DEMO_GOALS.security_audit!;

    const events: string[] = [];
    orchestrator.subscribeEvents((e) => events.push(e.type));

    const instance = await orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE');

    assert.ok(instance.status === 'CONSENSUS_REACHED' || instance.status === 'COMPLETED');
    assert.ok(instance.messages.length >= 2);
    assert.ok(instance.verdict !== undefined);
    assert.strictEqual(events.includes('SWARM_STARTED'), true);
    assert.strictEqual(events.includes('SWARM_COMPLETED'), true);
  });

  it('should execute hierarchical delegation swarm', async () => {
    const orchestrator = bootstrapDefaultSwarm();
    const goal = {
      id: 'hierarchical-test',
      title: 'Decompose and audit infrastructure architecture',
      description: 'Leader decomposes tasks to specialists and synthesizes.',
      maxRounds: 3,
    };

    const instance = await orchestrator.executeSwarm(goal, 'HIERARCHICAL');
    assert.strictEqual(instance.status, 'CONSENSUS_REACHED');
    assert.ok(instance.messages.length > 0);
  });

  it('should immediately cancel swarm execution when cancelSwarm is invoked', async () => {
    const orchestrator = bootstrapDefaultSwarm();
    const goal = {
      id: 'cancel-test',
      title: 'Long running task to cancel',
      description: 'Will be aborted',
      maxRounds: 10,
    };

    const promise = orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE', 'inst-to-cancel');

    // Trigger cancel shortly after start
    await new Promise((r) => setTimeout(r, 80));
    const cancelled = orchestrator.cancelSwarm('inst-to-cancel');
    assert.strictEqual(cancelled, true);

    const instance = await promise;
    assert.strictEqual(instance.status, 'CANCELLED');
    assert.ok(instance.error?.includes('cancelled'));
  });
});
