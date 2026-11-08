/**
 * AgentMesh - Built-in Domain & Security Tools
 * Sandboxed utility tools for multi-agent reasoning and task fulfillment.
 */

import { ToolDefinition } from '../types.js';

/**
 * 1. Code Security & Vulnerability Scanner Tool
 */
export const SecurityScannerTool: ToolDefinition<{ codeSnippet: string; language: string }> = {
  name: 'security_scanner',
  description: 'Scans source code for security vulnerabilities, OWASP flaws, hardcoded secrets, and unsafe patterns.',
  parameters: {
    codeSnippet: {
      type: 'string',
      description: 'The code block to analyze',
      required: true,
    },
    language: {
      type: 'string',
      description: 'Programming language (typescript, javascript, python, sql)',
      required: true,
      enum: ['typescript', 'javascript', 'python', 'sql'],
    },
  },
  execute: async ({ codeSnippet, language }, ctx) => {
    ctx.log(`Scanning ${language} code for security flaws (${codeSnippet.length} chars)...`);
    await new Promise((r) => setTimeout(r, 200));

    const findings: Array<{ severity: 'HIGH' | 'MEDIUM' | 'LOW'; issue: string; rule: string }> = [];

    // Heuristic detection
    if (/eval\(|new Function\(|Function\(/.test(codeSnippet)) {
      findings.push({
        severity: 'HIGH',
        issue: 'Dynamic code execution via eval/Function allows arbitrary code injection.',
        rule: 'OWASP-A03-INJECTION',
      });
    }
    if (/(['"])(ghp_|sk_|api[_-]?key|secret|password|bearer\s+)[\w-]{8,}\1/i.test(codeSnippet)) {
      findings.push({
        severity: 'HIGH',
        issue: 'Potential hardcoded credential or secret detected in source.',
        rule: 'CWE-798-HARDCODED-CREDENTIALS',
      });
    }
    if (/SELECT\s+.+\s+FROM\s+.+\s+WHERE\s+.*\+.*['"]|`SELECT\s+.*`\s*\+/i.test(codeSnippet)) {
      findings.push({
        severity: 'HIGH',
        issue: 'Unsanitized string concatenation in SQL query.',
        rule: 'OWASP-A03-SQLI',
      });
    }
    if (/__proto__|prototype\[/i.test(codeSnippet)) {
      findings.push({
        severity: 'MEDIUM',
        issue: 'Direct modification of Object prototype property (Prototype Pollution risk).',
        rule: 'CWE-1321-PROTOTYPE-POLLUTION',
      });
    }

    return {
      status: findings.length === 0 ? 'CLEAN' : 'VULNERABILITIES_FOUND',
      vulnerabilityCount: findings.length,
      findings: findings.length === 0 ? [{ severity: 'LOW', issue: 'No high-risk security flaws identified.', rule: 'STATIC_ANALYSIS_PASS' }] : findings,
      riskScore: findings.filter((f) => f.severity === 'HIGH').length * 40 + findings.filter((f) => f.severity === 'MEDIUM').length * 20,
    };
  },
};

/**
 * 2. Safe Mathematical & Statistical Evaluator Tool
 */
export const MathEvaluatorTool: ToolDefinition<{ expression: string }> = {
  name: 'math_evaluator',
  description: 'Evaluates mathematical and statistical expressions deterministically in a safe sandbox.',
  parameters: {
    expression: {
      type: 'string',
      description: 'Arithmetic expression to compute (e.g., "(150 * 0.95) / 12")',
      required: true,
    },
  },
  execute: async ({ expression }, ctx) => {
    ctx.log(`Evaluating arithmetic expression: ${expression}`);
    // Strict allow-list: only digits, basic operators, parens, dot, whitespace, and known Math identifiers
    const allowedIdentifiers = new Set([
      'Math', 'PI', 'E', 'LN2', 'LN10', 'LOG2E', 'LOG10E', 'SQRT2',
      'abs', 'ceil', 'floor', 'round', 'sqrt', 'pow', 'log', 'log2', 'log10',
      'max', 'min', 'sin', 'cos', 'tan', 'atan', 'atan2', 'exp', 'sign', 'trunc', 'cbrt',
      'Infinity', 'NaN',
    ]);

    // Reject any identifier that is not in the allow-list
    const identifiers = expression.match(/[a-zA-Z_][a-zA-Z0-9_]*/g) || [];
    const forbidden = identifiers.filter((id) => !allowedIdentifiers.has(id));
    if (forbidden.length > 0) {
      throw new Error(`Disallowed identifiers in expression: ${forbidden.join(', ')}`);
    }

    // Strip everything except allowed characters
    const sanitized = expression.replace(/[^0-9+\-*/().,%^ MathPIELNSQRT\w\s]/g, '');

    try {
      // Evaluate within restricted function scope without access to globals
      const fn = new Function('Math', 'Infinity', 'NaN', `"use strict"; return (${sanitized});`);
      const result = fn(Math, Infinity, NaN);
      if (typeof result !== 'number') {
        throw new Error('Expression did not evaluate to a number.');
      }
      return {
        expression: sanitized,
        result: Number(result),
        isFinite: Number.isFinite(result),
      };
    } catch (e: any) {
      throw new Error(`Invalid mathematical expression "${expression}": ${e.message}`);
    }
  },
};

/**
 * 3. Knowledge & Standards Retrieval Tool
 */
export const KnowledgeRetrievalTool: ToolDefinition<{ query: string; domain: string }> = {
  name: 'knowledge_search',
  description: 'Searches internal compliance manuals, engineering standards, and RFC specifications.',
  parameters: {
    query: {
      type: 'string',
      description: 'Search keywords or topic inquiry',
      required: true,
    },
    domain: {
      type: 'string',
      description: 'Domain scope to query',
      required: true,
      enum: ['security', 'architecture', 'performance', 'cloud'],
    },
  },
  execute: async ({ query, domain }, ctx) => {
    ctx.log(`Querying ${domain} knowledge registry for: "${query}"...`);
    await new Promise((r) => setTimeout(r, 150));

    const knowledgeBase: Record<string, string[]> = {
      security: [
        'All external HTTP inputs must undergo strict boundary schema verification before DB dispatch.',
        'Credentials and encryption keys must be sourced strictly from environment or secret managers.',
        'Session tokens must enforce SameSite=Strict and HttpOnly flags.',
      ],
      architecture: [
        'Services must communicate via asynchronous messaging with idempotency keys.',
        'Microservices must implement Circuit Breakers and Graceful Degradation.',
        'DAG workflows must execute topologically without cyclic deadlocks.',
      ],
      performance: [
        'API endpoint latency P95 must stay below 200ms under 5,000 req/sec load.',
        'In-memory caches must use LRU eviction policies with bounded max elements.',
      ],
      cloud: [
        'Workloads must follow immutable infrastructure paradigms with zero persistent local state.',
        'Write-Ahead Logs must flush before acknowledging state mutations.',
      ],
    };

    const matches = knowledgeBase[domain] || [];
    return {
      domain,
      query,
      resultsCount: matches.length,
      documents: matches,
    };
  },
};

/**
 * 4. High-Stakes Remediation Patch Tool (Requires Human Operator Approval)
 */
export const RemediationPatchTool: ToolDefinition<{ targetService: string; patchAction: string; reason: string }> = {
  name: 'apply_remediation_patch',
  description: 'Applies an urgent security or operational patch to live infrastructure (Requires Human Approval).',
  requiresApproval: true,
  parameters: {
    targetService: {
      type: 'string',
      description: 'The microservice or gateway to patch',
      required: true,
    },
    patchAction: {
      type: 'string',
      description: 'Detailed description of the patch action',
      required: true,
    },
    reason: {
      type: 'string',
      description: 'Justification for the urgent intervention',
      required: true,
    },
  },
  execute: async ({ targetService, patchAction, reason }, ctx) => {
    ctx.log(`APPLYING HUMAN-APPROVED PATCH on ${targetService}: ${patchAction} (Reason: ${reason})`);
    await new Promise((r) => setTimeout(r, 350));
    return {
      success: true,
      targetService,
      patchAction,
      reason,
      appliedAt: new Date().toISOString(),
      ticketId: `INC-${Math.floor(1000 + Math.random() * 9000)}`,
      status: 'HOTFIX_DEPLOYED_SUCCESSFULLY',
    };
  },
};
