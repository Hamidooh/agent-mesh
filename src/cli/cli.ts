#!/usr/bin/env node
/**
 * AgentMesh - Command Line Interface (CLI)
 * Manage swarms, trigger multi-agent debates, and run autonomous benchmarks.
 */

import { bootstrapDefaultSwarm, DEMO_GOALS } from '../scenarios/security-audit-swarm.js';
import { AgentMeshServer } from '../server/http-server.js';
import { SwarmTopology } from '../types.js';

async function main() {
  const args = process.argv.slice(2);
  const command = args[0] || 'start';

  const getArg = (name: string, fallback: string) => {
    const idx = args.indexOf(name);
    return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
  };

  if (command === '--help' || command === '-h' || command === 'help') {
    printHelp();
    process.exit(0);
  }

  if (command === 'start' || command === 'dev') {
    const port = parseInt(getArg('--port', '3040'), 10);
    const orchestrator = bootstrapDefaultSwarm();
    const server = new AgentMeshServer({ port, orchestrator });

    await server.start();
    printBanner(port);

    process.on('SIGINT', async () => {
      console.log('\nGracefully shutting down AgentMesh server...');
      await server.stop();
      process.exit(0);
    });
  } else if (command === 'run') {
    const goalKey = getArg('--goal', 'security_audit');
    const topology = getArg('--topology', 'COLLABORATIVE_DEBATE') as SwarmTopology;
    const goal = DEMO_GOALS[goalKey] || DEMO_GOALS.security_audit!;

    console.log(`\n🚀 Launching Swarm Deliberation: "${goal.title}"`);
    console.log(`Topology: ${topology} | Max Rounds: ${goal.maxRounds}\n`);

    const orchestrator = bootstrapDefaultSwarm();
    const instance = await orchestrator.executeSwarm(goal, topology);

    console.log(`\n======================================================`);
    console.log(`💬 Multi-Agent Debate Transcript (${instance.messages.length} messages)`);
    console.log(`======================================================`);
    for (const msg of instance.messages) {
      const time = new Date(msg.timestamp).toLocaleTimeString();
      console.log(`[${time}] ${msg.metadata?.avatar || '🤖'} ${msg.fromAgentName} (${msg.type}):`);
      console.log(`   ${msg.content.replace(/\n/g, '\n   ')}\n`);
    }

    if (instance.toolInvocations.length > 0) {
      console.log(`🛠️ Tools Invoked (${instance.toolInvocations.length}):`);
      for (const t of instance.toolInvocations) {
        console.log(`   - ${t.toolName} (${t.durationMs}ms) by ${t.agentId}: ${JSON.stringify(t.output || t.error).slice(0, 80)}`);
      }
      console.log('');
    }

    console.log(`======================================================`);
    console.log(`⚖️ Consensus Verdict:`);
    console.log(`   Reached:    ${instance.verdict?.reached ? '✔ YES' : '❌ NO'}`);
    console.log(`   Confidence: ${((instance.verdict?.confidenceScore || 0) * 100).toFixed(0)}%`);
    console.log(`   Synthesis:  ${instance.verdict?.synthesis}`);
    console.log(`   Duration:   ${instance.durationMs}ms`);
    console.log(`======================================================\n`);
  } else if (command === 'bench') {
    const count = parseInt(getArg('--swarms', '15'), 10);
    console.log(`\n⚡ Running AgentMesh Synthetic Benchmark (${count} swarms)...`);
    const orchestrator = bootstrapDefaultSwarm();
    const start = Date.now();

    const promises = [];
    for (let i = 0; i < count; i++) {
      promises.push(
        orchestrator.executeSwarm(
          {
            id: `bench-goal-${i}`,
            title: `Benchmark Task #${i}`,
            description: 'Synthetic multi-agent evaluation under concurrent load',
            maxRounds: 2,
          },
          'VOTING_CONSENSUS'
        )
      );
    }

    await Promise.all(promises);
    const durationMs = Date.now() - start;
    const metrics = orchestrator.getMetrics();

    console.log('\n📊 Benchmark Results:');
    console.log(`-----------------------------------------------`);
    console.log(`Total Swarms Completed:  ${metrics.totalGoalsExecuted}`);
    console.log(`Total Execution Time:    ${durationMs}ms`);
    console.log(`Swarm Throughput:        ${((count / durationMs) * 1000).toFixed(2)} swarms/sec`);
    console.log(`Total Debate Turns:      ${metrics.totalDebateTurns}`);
    console.log(`Average Swarm Duration:  ${metrics.averageSwarmDurationMs}ms`);
    console.log(`Consensus Rate:          ${metrics.consensusRate}%`);
    console.log(`-----------------------------------------------\n`);
  } else {
    console.error(`Unknown command: "${command}". Run "agentmesh --help" for usage.`);
    process.exit(1);
  }
}

function printBanner(port: number) {
  console.log(`
\x1b[35m  █████╗  ██████╗ ███████╗███╗   ██╗████████╗███╗   ███╗███████╗███████╗██╗  ██╗
  ██╔══██╗██╔════╝ ██╔════╝████╗  ██║╚══██╔══╝████╗ ████║██╔════╝██╔════╝██║  ██║
  ███████║██║  ███╗█████╗  ██╔██╗ ██║   ██║   ██╔████╔██║█████╗  ███████╗███████║
  ██╔══██║██║   ██║██╔══╝  ██║╚██╗██║   ██║   ██║╚██╔╝██║██╔══╝  ╚════██║██╔══██║
  ██║  ██║╚██████╔╝███████╗██║ ╚████║   ██║   ██║ ╚═╝ ██║███████╗███████║██║  ██║
  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝  ╚═══╝   ╚═╝   ╚═╝     ╚═╝╚══════╝╚══════╝╚═╝  ╚═╝\x1b[0m
  \x1b[90mAutonomous Multi-Agent Swarm Orchestrator & Task Mesh Runtime\x1b[0m

  \x1b[32m✔ Server listening at:\x1b[0m   \x1b[1mhttp://localhost:${port}\x1b[0m
  \x1b[32m✔ Web Visualizer:\x1b[0m        \x1b[1mhttp://localhost:${port}/\x1b[0m
  \x1b[32m✔ WebSocket Telemetry:\x1b[0m   \x1b[1mws://localhost:${port}/ws\x1b[0m
  \x1b[32m✔ Swarm Personas:\x1b[0m        \x1b[33mArchitect, Auditor, Perf Engineer, Critic, Judge\x1b[0m
  \x1b[32m✔ Memory Vector Store:\x1b[0m   \x1b[33mTF-IDF Cosine Similarity Engine\x1b[0m

  \x1b[90mPress Ctrl+C to terminate\x1b[0m
`);
}

function printHelp() {
  console.log(`
AgentMesh CLI v1.0.0

Usage:
  agentmesh <command> [options]

Commands:
  start               Start the Swarm HTTP API, WebSocket telemetry, and Web Visualizer
  run                 Execute a multi-agent debate/swarm directly in the terminal
  bench               Run concurrent synthetic multi-agent load benchmark
  help, --help        Show this help message

Options:
  --port <number>         Port to bind server to (default: 3040)
  --goal <key>            Goal preset (security_audit, perf_review, incident_triage)
  --topology <type>       COLLABORATIVE_DEBATE | HIERARCHICAL | VOTING_CONSENSUS | ROUND_ROBIN
  --swarms <number>       Number of concurrent swarms for benchmark (default: 15)

Examples:
  agentmesh start --port 3040
  agentmesh run --goal security_audit --topology COLLABORATIVE_DEBATE
  agentmesh bench --swarms 25
`);
}

const isMainScript =
  process.argv[1]?.endsWith('cli.ts') ||
  process.argv[1]?.endsWith('cli.js') ||
  process.argv[1]?.endsWith('agentmesh');

if (isMainScript) {
  main().catch((err) => {
    console.error('Fatal CLI Error:', err);
    process.exit(1);
  });
}
