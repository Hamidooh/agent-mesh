# ADR 001: Deterministic Multi-Agent Topologies and Message Routing

## Status
Accepted

## Context
Multi-agent frameworks often suffer from chaotic message loops, runaway conversational recursion, and non-deterministic outcomes when agents communicate as an unconstrained broadcast network.

## Decision
We implemented four explicit, deterministic topologies managed by the `SwarmRouter`:
1. `COLLABORATIVE_DEBATE`: Alternating dialectic rounds between proponent and critic, concluding with an executive judge.
2. `HIERARCHICAL`: Strict top-down delegation where a Planner allocates sub-tasks to specialists, and an Evaluator synthesizes.
3. `VOTING_CONSENSUS`: Parallel independent evaluations with mathematical confidence scoring.
4. `ROUND_ROBIN`: Ordered peer-to-peer relay.

## Consequences
- Prevents infinite conversational deadlocks.
- Guarantees that every deliberation terminates within `maxRounds`.
- Produces structured, inspectable transcripts suitable for real-time visualization.
