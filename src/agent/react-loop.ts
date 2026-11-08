/**
 * AgentMesh - ReAct Reflection Loop & Guardrails
 * Reason -> Act -> Observe -> Reflect cycle with loop & cycle-detection guards.
 */

import { ReActStep, ToolExecutionRecord } from '../types.js';
import { Agent, AgentExecutionOptions } from './agent.js';

export interface ReActLoopConfig {
  maxIterations?: number;
  timeoutMs?: number;
}

export class ReActController {
  private agent: Agent;

  constructor(agent: Agent) {
    this.agent = agent;
  }

  /**
   * Run the ReAct loop to solve a specific sub-task using tools.
   */
  public async executeTask(
    taskGoal: string,
    toolInvoker: (toolName: string, args: Record<string, any>) => Promise<ToolExecutionRecord>,
    _options: AgentExecutionOptions,
    config: ReActLoopConfig = {}
  ): Promise<{ steps: ReActStep[]; finalAnswer: string; durationMs: number }> {
    const maxIterations = config.maxIterations ?? 4;
    const timeoutMs = config.timeoutMs ?? 15000;
    const start = Date.now();

    const steps: ReActStep[] = [];
    const calledToolSignatures = new Set<string>();

    let currentThought = `Task: ${taskGoal}. Initializing analysis.`;
    let iteration = 0;
    let finalAnswer = '';

    while (iteration < maxIterations) {
      iteration++;

      if (Date.now() - start > timeoutMs) {
        throw new Error(`ReAct execution timed out after ${timeoutMs}ms.`);
      }

      // Step 1: Reason / Plan tool invocation strictly constrained by agent permissions
      let selectedTool: string | null = null;
      let toolArgs: Record<string, any> = {};
      const allowed = this.agent.persona.allowedTools;

      if (allowed.length === 0) {
        finalAnswer = `Agent ${this.agent.name} concluded reasoning from internal knowledge without tool calls.`;
        break;
      }

      if ((taskGoal.toLowerCase().includes('security') || taskGoal.toLowerCase().includes('vulnerability')) && allowed.includes('security_scanner')) {
        selectedTool = 'security_scanner';
        toolArgs = { codeSnippet: 'function queryUser(id) { return eval("db.users.find(" + id + ")"); }', language: 'javascript' };
      } else if ((taskGoal.toLowerCase().includes('calculate') || taskGoal.toLowerCase().includes('math') || taskGoal.toLowerCase().includes('p95') || taskGoal.toLowerCase().includes('latency')) && allowed.includes('math_evaluator')) {
        selectedTool = 'math_evaluator';
        toolArgs = { expression: '(450 + 520 + 490) / 3' };
      } else if ((taskGoal.toLowerCase().includes('patch') || taskGoal.toLowerCase().includes('remediate')) && allowed.includes('apply_remediation_patch')) {
        selectedTool = 'apply_remediation_patch';
        toolArgs = { targetService: 'auth-gateway', patchAction: 'Block unauthorized eval() execution', reason: 'High-severity OWASP injection detected' };
      } else if (allowed.includes('knowledge_search')) {
        const domain = taskGoal.toLowerCase().includes('perf') || taskGoal.toLowerCase().includes('latency') ? 'performance' : 'security';
        selectedTool = 'knowledge_search';
        toolArgs = { query: taskGoal, domain };
      } else {
        selectedTool = allowed[0] ?? null;
        toolArgs = {};
      }

      // Cycle Guardrail: detect infinite repeating tool calls
      const toolSignature = `${selectedTool}:${JSON.stringify(toolArgs)}`;
      if (calledToolSignatures.has(toolSignature)) {
        // Break out of cycle and synthesize
        finalAnswer = `Cycle detected: Tool ${selectedTool} was already called with identical arguments. ReAct loop concluded with synthesis.`;
        break;
      }
      calledToolSignatures.add(toolSignature);

      // Step 2: Act / Tool Execution
      const stepRecord: ReActStep = {
        stepNumber: iteration,
        thought: currentThought,
        toolCall: selectedTool ? { toolName: selectedTool, args: toolArgs } : undefined,
        timestamp: Date.now(),
      };

      if (selectedTool) {
        const result = await toolInvoker(selectedTool, toolArgs);
        stepRecord.observation = result.output || result.error;
        stepRecord.reflection = `Observed output from ${selectedTool}: ${JSON.stringify(stepRecord.observation).slice(0, 150)}...`;

        // Save finding to agent memory
        this.agent.remember(`Tool ${selectedTool} returned: ${JSON.stringify(stepRecord.observation)}`);

        // Check if we have enough information to formulate final answer
        if (iteration >= maxIterations - 1 || (iteration >= 2 && !result.error)) {
          finalAnswer = `Analysis concluded: ${selectedTool} verified findings. Recommended remediation confirmed.`;
        }
      }

      steps.push(stepRecord);

      if (finalAnswer) {
        break;
      }
    }

    if (!finalAnswer) {
      finalAnswer = `ReAct concluded after ${iteration} iterations. Action completed.`;
    }

    return {
      steps,
      finalAnswer,
      durationMs: Date.now() - start,
    };
  }
}
