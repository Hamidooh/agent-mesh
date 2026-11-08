/**
 * Example 03: Autonomous Incident Response with Human-in-the-Loop Sign-off
 * Demonstrates high-stakes remediation tool requiring human operator approval.
 */

import { bootstrapDefaultSwarm, DEMO_GOALS } from '../src/index.js';

async function run() {
  console.log('\n======================================================');
  console.log('🚨 Running Example 03: Autonomous Incident Triage (HITL)');
  console.log('======================================================\n');

  const orchestrator = bootstrapDefaultSwarm();
  const goal = DEMO_GOALS.incident_triage!;

  console.log(`Incident: "${goal.title}"`);

  // Auto-approve after 300ms to simulate operator sign-off in automated script
  const approvalWatcher = setInterval(() => {
    const pending = orchestrator.getToolRegistry().getPendingApprovals();
    if (pending.length > 0) {
      const app = pending[0]!;
      console.log(`\n🔔 [Human Operator]: Approving hotfix patch for "${app.toolName}"...`);
      orchestrator.getToolRegistry().resolveApproval(app.id, true);
      clearInterval(approvalWatcher);
    }
  }, 100);

  const instance = await orchestrator.executeSwarm(goal, 'COLLABORATIVE_DEBATE');
  clearInterval(approvalWatcher);

  console.log('\n✔ Incident Triage Completed!');
  console.log(`Status:    ${instance.status}`);
  console.log(`Tools Run: ${instance.toolInvocations.map((t) => t.toolName).join(', ')}`);
  console.log(`Synthesis: ${instance.verdict?.synthesis}\n`);
}

run().catch(console.error);
