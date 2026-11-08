/**
 * Example 01: Multi-Agent Security & Vulnerability Audit Swarm
 * Executes a collaborative debate analyzing an authentication pathway for OWASP flaws.
 */

import { bootstrapDefaultSwarm, DEMO_GOALS } from '../src/index.js';

async function run() {
  console.log('\n======================================================');
  console.log('🛡️ Running Example 01: Multi-Agent Security Audit Swarm');
  console.log('======================================================\n');

  const orchestrator = bootstrapDefaultSwarm();
  const goal = DEMO_GOALS.security_audit!;

  console.log(`Goal: "${goal.title}"`);
  console.log(`Topology: COLLABORATIVE_DEBATE | Max Rounds: ${goal.maxRounds}\n`);

  orchestrator.subscribeEvents((event) => {
    if (event.type === 'AGENT_MESSAGE') {
      const msg = event.payload;
      console.log(`[${msg.fromAgentName}]: ${msg.content.slice(0, 100)}...`);
    } else if (event.type === 'TOOL_INVOKED') {
      const tool = event.payload;
      console.log(`   -> [Tool Call]: ${tool.toolName} (${tool.durationMs}ms)`);
    }
  });

  const instance = await orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE');

  console.log('\n✔ Swarm Completed!');
  console.log(`Instance ID: ${instance.id}`);
  console.log(`Status:      ${instance.status}`);
  console.log(`Duration:    ${instance.durationMs}ms`);
  console.log(`Consensus:   ${instance.verdict?.reached ? 'YES' : 'NO'} (${((instance.verdict?.confidenceScore || 0) * 100).toFixed(0)}% confidence)`);
  console.log(`Synthesis:   ${instance.verdict?.synthesis}\n`);
}

run().catch(console.error);
