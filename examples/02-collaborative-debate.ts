/**
 * Example 02: Collaborative Multi-Agent Debate & Dialectic Synthesis
 * Two opposing agents deliberate on latency budgets and worker pool concurrency.
 */

import { bootstrapDefaultSwarm, DEMO_GOALS } from '../src/index.js';

async function run() {
  console.log('\n======================================================');
  console.log('⚡ Running Example 02: Performance & Architecture Debate');
  console.log('======================================================\n');

  const orchestrator = bootstrapDefaultSwarm();
  const goal = DEMO_GOALS.perf_review!;

  console.log(`Goal: "${goal.title}"`);
  console.log(`Topology: COLLABORATIVE_DEBATE | Max Rounds: ${goal.maxRounds}\n`);

  orchestrator.subscribeEvents((event) => {
    if (event.type === 'AGENT_MESSAGE') {
      const msg = event.payload;
      console.log(`[${msg.fromAgentName}]: ${msg.content.slice(0, 100)}...`);
    }
  });

  const instance = await orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE');

  console.log('\n✔ Debate Concluded!');
  console.log(`Total Turns: ${instance.messages.length}`);
  console.log(`Verdict:     ${instance.verdict?.synthesis}\n`);
}

run().catch(console.error);
