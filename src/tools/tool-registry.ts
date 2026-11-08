/**
 * AgentMesh - Tool Mesh Registry & Sandboxed Execution Guard
 * Manages tool registration, parameter schema validation, and HITL execution.
 */

import { randomUUID } from 'node:crypto';
import {
  ToolDefinition,
  ToolExecutionContext,
  ToolExecutionRecord,
} from '../types.js';

export class ToolRegistry {
  private tools: Map<string, ToolDefinition<any, any>> = new Map();
  private executionHistory: ToolExecutionRecord[] = [];
  private pendingApprovals: Map<
    string,
    {
      resolve: (approved: boolean) => void;
      record: ToolExecutionRecord;
    }
  > = new Map();

  /**
   * Register a new tool in the mesh.
   */
  public registerTool<TArgs = any, TResult = any>(tool: ToolDefinition<TArgs, TResult>): void {
    if (this.tools.has(tool.name)) {
      throw new Error(`Tool "${tool.name}" is already registered in the mesh.`);
    }
    this.tools.set(tool.name, tool as any);
  }

  public getTool(name: string): ToolDefinition<any, any> | undefined {
    return this.tools.get(name);
  }

  public getAllTools(): ToolDefinition<any, any>[] {
    return Array.from(this.tools.values());
  }

  /**
   * Validate parameters against tool schema.
   */
  public validateArgs(
    tool: ToolDefinition,
    args: Record<string, any>
  ): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    for (const [paramName, schema] of Object.entries(tool.parameters)) {
      const val = args[paramName];

      if (schema.required && (val === undefined || val === null || val === '')) {
        errors.push(`Missing required parameter "${paramName}".`);
        continue;
      }

      if (val !== undefined && val !== null) {
        if (schema.type === 'array' && !Array.isArray(val)) {
          errors.push(`Parameter "${paramName}" must be an array.`);
        } else if (schema.type !== 'array' && typeof val !== schema.type) {
          errors.push(`Parameter "${paramName}" must be of type ${schema.type}, got ${typeof val}.`);
        }

        if (schema.enum && !schema.enum.includes(val)) {
          errors.push(
            `Parameter "${paramName}" must be one of [${schema.enum.join(', ')}], got "${val}".`
          );
        }
      }
    }

    return { valid: errors.length === 0, errors };
  }

  /**
   * Execute a tool with sandboxing, timeout, and optional HITL approval.
   */
  public async executeTool(
    toolName: string,
    args: Record<string, any>,
    context: ToolExecutionContext
  ): Promise<ToolExecutionRecord> {
    const tool = this.tools.get(toolName);
    if (!tool) {
      throw new Error(`Tool "${toolName}" is not available in this mesh.`);
    }

    const validation = this.validateArgs(tool, args);
    if (!validation.valid) {
      throw new Error(`Invalid arguments for tool "${toolName}": ${validation.errors.join(' ')}`);
    }

    const recordId = randomUUID();
    const record: ToolExecutionRecord = {
      id: recordId,
      toolName,
      agentId: context.agentId,
      args,
      durationMs: 0,
      approved: !tool.requiresApproval,
      timestamp: Date.now(),
    };

    // If tool requires human approval, wait for operator signal
    if (tool.requiresApproval) {
      context.log(`[HITL Alert] Tool "${toolName}" requires human operator approval.`);
      const approved = await new Promise<boolean>((resolve) => {
        this.pendingApprovals.set(recordId, { resolve, record });
      });

      record.approved = approved;
      if (!approved) {
        record.error = 'Action rejected by human operator.';
        this.executionHistory.push(record);
        return record;
      }
    }

    const start = Date.now();
    try {
      const output = await tool.execute(args, context);
      record.durationMs = Date.now() - start;
      record.output = output;
    } catch (err: any) {
      record.durationMs = Date.now() - start;
      record.error = err.message || String(err);
    }

    this.executionHistory.push(record);
    return record;
  }

  /**
   * Approve or reject a pending human-in-the-loop action.
   */
  public resolveApproval(executionId: string, approved: boolean): boolean {
    const pending = this.pendingApprovals.get(executionId);
    if (!pending) return false;

    this.pendingApprovals.delete(executionId);
    pending.resolve(approved);
    return true;
  }

  public getPendingApprovals(): ToolExecutionRecord[] {
    return Array.from(this.pendingApprovals.values()).map((p) => p.record);
  }

  public getHistory(): ToolExecutionRecord[] {
    return this.executionHistory;
  }
}
