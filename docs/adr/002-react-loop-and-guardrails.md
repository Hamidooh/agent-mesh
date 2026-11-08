# ADR 002: ReAct Reflection Loop & Guardrails

## Status
Accepted

## Context
When autonomous agents interact with external tools, they may enter repetitive execution loops (calling the same tool with the same arguments repeatedly), exceed timeouts, or attempt unauthorized actions.

## Decision
We implemented the `ReActController` with three layered guardrails:
1. **Permission Check**: Tool invocations are strictly validated against `agent.persona.allowedTools`.
2. **Cycle Signature Detection**: Every tool invocation signature (`toolName:argsJSON`) is tracked in a set. If an identical call is repeated, the loop immediately terminates and synthesizes findings.
3. **Human-in-the-Loop (HITL) Gate**: Tools marked with `requiresApproval: true` suspend execution until an operator submits approval via REST/WebSocket.

## Consequences
- Guaranteed loop termination.
- Safe execution of high-stakes remediation actions without risking runaway automated changes.
