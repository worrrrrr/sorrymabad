import { json } from "@sveltejs/kit";
import { z } from "zod";
import Graph from "graphlib";
const UserIntentSchema = z.object({
  intentId: z.string().uuid(),
  rawQuery: z.string().min(1).max(2e3),
  category: z.enum([
    "search",
    "calculation",
    "analysis",
    "synthesis",
    "verification",
    "unknown"
  ]),
  confidence: z.number().min(0).max(1),
  parameters: z.record(z.string(), z.unknown()).optional(),
  timestamp: z.number()
});
const TaskStepSchema = z.object({
  stepId: z.string().uuid(),
  toolType: z.enum([
    "search",
    "calculator",
    "solver",
    "validator",
    "synthesizer",
    "template_renderer"
  ]),
  description: z.string(),
  dependencies: z.array(z.string()).default([]),
  // References to other stepIds
  inputVariables: z.array(z.string()).default([]),
  // Variables like $1, $2 to resolve
  outputSchema: z.record(z.string(), z.unknown()).optional(),
  timeout: z.number().default(3e4),
  retries: z.number().default(2),
  priority: z.number().default(0)
});
z.object({
  toolId: z.string(),
  name: z.string(),
  version: z.string(),
  description: z.string(),
  inputSchema: z.record(z.string(), z.unknown()),
  outputSchema: z.record(z.string(), z.unknown()),
  executionMode: z.enum(["sync", "worker_thread", "child_process"]),
  memoryIsolation: z.boolean().default(false),
  maxMemoryMB: z.number().optional()
});
const PipelineResultSchema = z.object({
  pipelineId: z.string().uuid(),
  userIntent: UserIntentSchema,
  executionGraph: z.array(TaskStepSchema),
  results: z.record(z.string(), z.unknown()),
  // stepId -> result
  errors: z.array(
    z.object({
      stepId: z.string(),
      error: z.string(),
      recoverable: z.boolean()
    })
  ).default([]),
  metadata: z.object({
    startTime: z.number(),
    endTime: z.number(),
    duration: z.number(),
    llmUsed: z.boolean().optional(),
    fallbackUsed: z.boolean().optional(),
    circuitBreakerOpen: z.boolean().optional()
  }),
  status: z.enum(["success", "partial", "failed"])
});
z.object({
  source: z.string(),
  rawContent: z.string(),
  sanitizedContent: z.string(),
  injectionAttempts: z.array(z.string()).default([]),
  trustScore: z.number().min(0).max(1),
  timestamp: z.number()
});
z.object({
  providerId: z.string(),
  state: z.enum(["closed", "open", "half_open"]),
  failures: z.number().default(0),
  successes: z.number().default(0),
  lastFailureTime: z.number().optional(),
  nextRetryTime: z.number().optional(),
  threshold: z.number().default(5),
  resetTimeout: z.number().default(6e4)
});
z.object({
  taskId: z.string().uuid(),
  toolType: z.string(),
  payload: z.record(z.string(), z.unknown()),
  priority: z.number().default(0),
  timeout: z.number().default(3e4)
});
z.object({
  taskId: z.string(),
  success: z.boolean(),
  result: z.unknown().optional(),
  error: z.string().optional(),
  executionTime: z.number(),
  memoryUsed: z.number().optional()
});
const DEFAULT_PATTERNS = [
  // Search patterns
  {
    pattern: /\b(search|find|look up|google|query)\b/i,
    category: "search"
  },
  {
    pattern: /\b(what is|who is|where is|when is|how to)\b/i,
    category: "search"
  },
  // Calculation patterns
  {
    pattern: /\d+\s*[\+\-\*\/]\s*\d+/,
    category: "calculation"
  },
  {
    pattern: /\b(calculate|compute|solve|evaluate)\b/i,
    category: "calculation"
  },
  // Analysis patterns
  {
    pattern: /\b(analyze|compare|contrast|break down|examine)\b/i,
    category: "analysis"
  },
  // Verification patterns
  {
    pattern: /\b(verify|validate|check|confirm|prove)\b/i,
    category: "verification"
  },
  // Synthesis patterns
  {
    pattern: /\b(summarize|synthesize|combine|merge|overview)\b/i,
    category: "synthesis"
  }
];
function extractParameters(query, category) {
  const params = {};
  switch (category) {
    case "calculation": {
      const calcMatch = query.match(/([\d.]+)\s*([\+\-\*\/])\s*([\d.]+)/);
      if (calcMatch) {
        params.numbers = [parseFloat(calcMatch[1]), parseFloat(calcMatch[3])];
        params.operator = calcMatch[2];
      }
      break;
    }
    case "search": {
      const searchTerms = query.replace(/^(search|find|look up|what is|who is|where is|when is|how to)\s+/i, "");
      params.searchTerms = searchTerms.trim();
      break;
    }
    case "analysis": {
      const analysisMatch = query.match(/analyze\s+(.+?)(?:\s+and\s+(.+))?$/i);
      if (analysisMatch) {
        params.primarySubject = analysisMatch[1]?.trim();
        params.secondarySubject = analysisMatch[2]?.trim();
      }
      break;
    }
  }
  return params;
}
function routeIntent(query, config = { llmFallbackEnabled: false, minConfidenceThreshold: 0.7 }) {
  const normalizedQuery = query.trim().toLowerCase();
  const patterns = [...DEFAULT_PATTERNS, ...config.customPatterns || []];
  let bestMatch = {
    category: "unknown",
    confidence: 0
  };
  for (const { pattern, category } of patterns) {
    const match = pattern.test(normalizedQuery);
    if (match) {
      const confidence = calculateConfidence(pattern, normalizedQuery);
      if (confidence > bestMatch.confidence) {
        bestMatch = {
          category,
          confidence,
          matchedPattern: pattern.source,
          parameters: extractParameters(query, category)
        };
      }
    }
  }
  if (bestMatch.confidence < config.minConfidenceThreshold) {
    bestMatch.category = "unknown";
    bestMatch.confidence = 0.5;
  }
  return bestMatch;
}
function calculateConfidence(pattern, query) {
  const match = query.match(pattern);
  if (!match) return 0;
  let confidence = 0.5;
  if (match[0].length > 5) {
    confidence += 0.2;
  }
  const indicatorCount = query.match(pattern)?.length || 0;
  if (indicatorCount > 1) {
    confidence += 0.15;
  }
  return Math.min(confidence, 0.95);
}
function createIntentFromQuery(query, intentId, config) {
  const routeMatch = routeIntent(query, config);
  return {
    intentId,
    rawQuery: query,
    category: routeMatch.category,
    confidence: routeMatch.confidence,
    parameters: routeMatch.parameters,
    timestamp: Date.now()
  };
}
const PLANNING_RULES = [
  {
    intentCategory: "search",
    template: [
      {
        stepId: "step_1",
        toolType: "search",
        description: "Execute search query",
        dependencies: [],
        inputVariables: ["$1"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      },
      {
        stepId: "step_2",
        toolType: "validator",
        description: "Validate search results",
        dependencies: ["step_1"],
        inputVariables: ["$1"],
        timeout: 5e3,
        retries: 1,
        priority: 1
      }
    ],
    dependencyResolver: (steps) => {
      steps[1].dependencies = ["step_1"];
    }
  },
  {
    intentCategory: "calculation",
    template: [
      {
        stepId: "step_1",
        toolType: "calculator",
        description: "Perform calculation",
        dependencies: [],
        inputVariables: ["$1", "$2"],
        timeout: 5e3,
        retries: 1,
        priority: 0
      },
      {
        stepId: "step_2",
        toolType: "validator",
        description: "Verify calculation result",
        dependencies: ["step_1"],
        inputVariables: ["$1"],
        timeout: 3e3,
        retries: 1,
        priority: 1
      }
    ]
  },
  {
    intentCategory: "analysis",
    template: [
      {
        stepId: "step_1",
        toolType: "search",
        description: "Gather data for primary subject",
        dependencies: [],
        inputVariables: ["$1"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      },
      {
        stepId: "step_2",
        toolType: "search",
        description: "Gather data for secondary subject",
        dependencies: [],
        inputVariables: ["$2"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      },
      {
        stepId: "step_3",
        toolType: "synthesizer",
        description: "Synthesize analysis from gathered data",
        dependencies: ["step_1", "step_2"],
        inputVariables: ["$1", "$2"],
        timeout: 15e3,
        retries: 1,
        priority: 2
      }
    ]
  },
  {
    intentCategory: "verification",
    template: [
      {
        stepId: "step_1",
        toolType: "search",
        description: "Find verification sources",
        dependencies: [],
        inputVariables: ["$1"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      },
      {
        stepId: "step_2",
        toolType: "solver",
        description: "Apply verification logic",
        dependencies: ["step_1"],
        inputVariables: ["$1"],
        timeout: 2e4,
        retries: 1,
        priority: 1
      }
    ]
  },
  {
    intentCategory: "synthesis",
    template: [
      {
        stepId: "step_1",
        toolType: "search",
        description: "Gather source materials",
        dependencies: [],
        inputVariables: ["$1"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      },
      {
        stepId: "step_2",
        toolType: "template_renderer",
        description: "Render synthesized output",
        dependencies: ["step_1"],
        inputVariables: ["$1"],
        timeout: 5e3,
        retries: 1,
        priority: 1
      }
    ]
  },
  {
    intentCategory: "unknown",
    template: [
      {
        stepId: "step_1",
        toolType: "search",
        description: "General search for unknown intent",
        dependencies: [],
        inputVariables: ["$1"],
        timeout: 1e4,
        retries: 2,
        priority: 0
      }
    ]
  }
];
function resolveVariables(steps, parameters) {
  if (!parameters) return steps;
  const paramArray = Object.values(parameters);
  return steps.map((step) => ({
    ...step,
    inputVariables: step.inputVariables.map((variable) => {
      const varMatch = variable.match(/^\$(\d+)$/);
      if (varMatch) {
        const index = parseInt(varMatch[1], 10) - 1;
        if (index >= 0 && index < paramArray.length) {
          return String(paramArray[index]);
        }
      }
      if (parameters[variable]) {
        return String(parameters[variable]);
      }
      return variable;
    })
  }));
}
function buildDAG(intent) {
  const rule = PLANNING_RULES.find(
    (r) => r.intentCategory === intent.category
  ) || PLANNING_RULES.find((r) => r.intentCategory === "unknown");
  let steps = JSON.parse(JSON.stringify(rule.template));
  steps = resolveVariables(steps, intent.parameters);
  if (rule.dependencyResolver) {
    rule.dependencyResolver(steps);
  }
  const graph = new Graph.Graph({ directed: true });
  const stepMap = /* @__PURE__ */ new Map();
  for (const step of steps) {
    graph.setNode(step.stepId, step);
    stepMap.set(step.stepId, step);
  }
  for (const step of steps) {
    for (const dep of step.dependencies) {
      if (graph.hasNode(dep)) {
        graph.setEdge(dep, step.stepId);
      }
    }
  }
  if (hasCycle(graph)) {
    throw new Error("Invalid DAG: Cycle detected in execution plan");
  }
  return {
    graph,
    steps: stepMap,
    variableBindings: /* @__PURE__ */ new Map()
  };
}
function hasCycle(graph) {
  const nodes = graph.nodes();
  const visited = /* @__PURE__ */ new Set();
  const recursionStack = /* @__PURE__ */ new Set();
  function dfs(node) {
    if (recursionStack.has(node)) {
      return true;
    }
    if (visited.has(node)) {
      return false;
    }
    visited.add(node);
    recursionStack.add(node);
    const successors = graph.successors(node) || [];
    for (const successor of successors) {
      if (dfs(successor)) {
        return true;
      }
    }
    recursionStack.delete(node);
    return false;
  }
  for (const node of nodes) {
    if (!visited.has(node)) {
      if (dfs(node)) {
        return true;
      }
    }
  }
  return false;
}
function getExecutionOrder(plannedGraph) {
  return Graph.alg.topsort(plannedGraph.graph);
}
const DEFAULT_CONFIG$2 = {
  maxLength: 5e4,
  allowedTags: ["b", "i", "u", "strong", "em", "p", "br", "ul", "ol", "li", "a", "code", "pre"],
  blockPatterns: [
    // Prompt injection patterns
    /\b(ignore|forget|bypass|override)\s+(previous|all|instructions|rules)\b/i,
    /\b(system|assistant|user)\s*:\s*/i,
    /\byou\s+are\s+(now|no\s+longer)\b/i,
    /\b(new\s+instruction|new\s+rule|important)\b/i,
    // HTML/Script injection
    /<script[^>]*>[\s\S]*?<\/script>/gi,
    /javascript:/i,
    /data:text\/html/i,
    // Data exfiltration attempts
    /\bsend\s+(this|data|content)\s+to\b/i,
    /\bpost\s+to\s+url\b/i
  ],
  stripScripts: true,
  normalizeWhitespace: true
};
function detectInjectionAttempts(content, config = DEFAULT_CONFIG$2) {
  const attempts = [];
  for (const pattern of config.blockPatterns) {
    const matches = content.match(pattern);
    if (matches) {
      attempts.push(...matches.map((m) => m.trim()));
    }
  }
  return [...new Set(attempts)];
}
function calculateTrustScore(content, injectionAttempts, sourceType) {
  let score = 1;
  score -= injectionAttempts.length * 0.2;
  const lowTrustSources = ["user_comment", "forum", "social_media", "wiki"];
  if (lowTrustSources.includes(sourceType)) {
    score -= 0.1;
  }
  if (content.length > 1e4) {
    score -= 0.1;
  }
  const entropy = calculateEntropy(content);
  if (entropy > 6) {
    score -= 0.15;
  }
  return Math.max(0, Math.min(1, score));
}
function calculateEntropy(text) {
  if (text.length === 0) return 0;
  const freq = {};
  for (const char of text) {
    freq[char] = (freq[char] || 0) + 1;
  }
  let entropy = 0;
  const length = text.length;
  for (const count of Object.values(freq)) {
    const probability = count / length;
    entropy -= probability * Math.log2(probability);
  }
  return entropy;
}
function stripDangerousContent(content, config) {
  let sanitized = content;
  if (sanitized.length > config.maxLength) {
    sanitized = sanitized.substring(0, config.maxLength) + "...[truncated]";
  }
  if (config.stripScripts) {
    sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "");
    sanitized = sanitized.replace(/<script[^>]*>/gi, "");
    sanitized = sanitized.replace(/<\/script>/gi, "");
  }
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, "");
  sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, "");
  sanitized = sanitized.replace(/javascript:/gi, "blocked:");
  if (config.normalizeWhitespace) {
    sanitized = sanitized.replace(/\s+/g, " ").trim();
  }
  return sanitized;
}
async function sanitizeInput(rawContent, sourceType = "unknown", config) {
  const finalConfig = { ...DEFAULT_CONFIG$2, ...config };
  const injectionAttempts = detectInjectionAttempts(rawContent, finalConfig);
  const sanitizedContent = stripDangerousContent(rawContent, finalConfig);
  const trustScore = calculateTrustScore(sanitizedContent, injectionAttempts, sourceType);
  return {
    source: sourceType,
    rawContent,
    sanitizedContent,
    injectionAttempts,
    trustScore,
    timestamp: Date.now()
  };
}
const DEFAULT_CONFIG$1 = {
  maxRetries: 2,
  defaultTimeout: 3e4,
  enableSanitization: true,
  parallelExecution: true
};
const TOOL_HANDLERS = {
  search: {
    execute: async (input) => {
      const query = typeof input === "string" ? input : JSON.stringify(input);
      return {
        query,
        results: [
          { title: `Result for: ${query}`, content: "Sample content", url: "https://example.com" }
        ],
        timestamp: Date.now()
      };
    },
    validate: (output) => {
      return output !== null && output !== void 0;
    }
  },
  calculator: {
    execute: async (input) => {
      if (typeof input !== "object" || input === null) {
        throw new Error("Calculator requires object input with numbers and operator");
      }
      const calcInput = input;
      const numbers = calcInput.numbers || [];
      const operator = calcInput.operator || "+";
      if (numbers.length < 2) {
        throw new Error("Calculator requires at least 2 numbers");
      }
      let result = numbers[0];
      for (let i = 1; i < numbers.length; i++) {
        switch (operator) {
          case "+":
            result += numbers[i];
            break;
          case "-":
            result -= numbers[i];
            break;
          case "*":
            result *= numbers[i];
            break;
          case "/":
            if (numbers[i] === 0) {
              throw new Error("Division by zero");
            }
            result /= numbers[i];
            break;
          default:
            throw new Error(`Unknown operator: ${operator}`);
        }
      }
      return { result, expression: `${numbers.join(` ${operator} `)}` };
    },
    validate: (output) => {
      return output !== null && output !== void 0 && typeof output === "object" && "result" in output;
    }
  },
  solver: {
    execute: async (input, context) => {
      return {
        input,
        solution: "Solved via constraint logic",
        timestamp: Date.now()
      };
    },
    validate: (output) => {
      return output !== null && output !== void 0;
    }
  },
  validator: {
    execute: async (input) => {
      return {
        valid: input !== null && input !== void 0,
        input,
        timestamp: Date.now()
      };
    },
    validate: (output) => {
      return output !== null && output !== void 0 && typeof output === "object" && "valid" in output;
    }
  },
  synthesizer: {
    execute: async (input, context) => {
      return {
        input,
        synthesis: "Synthesized output from multiple sources",
        timestamp: Date.now()
      };
    },
    validate: (output) => {
      return output !== null && output !== void 0;
    }
  },
  template_renderer: {
    execute: async (input) => {
      const data = typeof input === "object" ? input : { value: input };
      const template = `
# Research Results
Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

## Data
${JSON.stringify(data, null, 2)}
`.trim();
      return {
        rendered: template,
        format: "markdown",
        timestamp: Date.now()
      };
    },
    validate: (output) => {
      return output !== null && output !== void 0 && typeof output === "object" && "rendered" in output;
    }
  }
};
async function executeStep(step, context, config, customTools) {
  const tools = { ...TOOL_HANDLERS, ...customTools };
  const handler = tools[step.toolType];
  if (!handler) {
    throw new Error(`Unknown tool type: ${step.toolType}`);
  }
  const resolvedInput = resolveStepInput(step, context.stepResults);
  let sanitizedInput = resolvedInput;
  if (config.enableSanitization && typeof resolvedInput === "string") {
    const sanitized = await sanitizeInput(resolvedInput, "user_input");
    sanitizedInput = sanitized.sanitizedContent;
  }
  let lastError = null;
  const maxAttempts = step.retries || config.maxRetries;
  const timeout = step.timeout || config.defaultTimeout;
  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeout);
      try {
        const result = await Promise.race([
          handler.execute(sanitizedInput, context),
          new Promise((_, reject) => {
            controller.signal.addEventListener("abort", () => {
              reject(new Error(`Step ${step.stepId} timed out after ${timeout}ms`));
            });
          })
        ]);
        clearTimeout(timeoutId);
        if (handler.validate && !handler.validate(result)) {
          throw new Error(`Step ${step.stepId} output validation failed`);
        }
        return result;
      } catch (error) {
        clearTimeout(timeoutId);
        throw error;
      }
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      console.error(`Step ${step.stepId} attempt ${attempt + 1} failed:`, lastError.message);
      if (attempt < maxAttempts - 1) {
        await sleep(Math.pow(2, attempt) * 1e3);
      }
    }
  }
  throw lastError || new Error(`Step ${step.stepId} failed after ${maxAttempts} attempts`);
}
function resolveStepInput(step, results) {
  if (step.inputVariables.length === 0) {
    return null;
  }
  if (step.inputVariables.length === 1) {
    const varName = step.inputVariables[0];
    const depResult = results.get(varName);
    if (depResult !== void 0) {
      return depResult;
    }
    return varName;
  }
  const inputObj = {};
  for (const varName of step.inputVariables) {
    const depResult = results.get(varName);
    inputObj[varName] = depResult !== void 0 ? depResult : varName;
  }
  return inputObj;
}
function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
class DAGExecutor {
  config;
  customTools;
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG$1, ...config };
    this.customTools = {};
  }
  /**
   * Register a custom tool handler
   */
  registerTool(toolType, handler) {
    this.customTools[toolType] = handler;
  }
  /**
   * Execute the entire DAG
   */
  async execute(graph, steps) {
    const context = {
      stepResults: /* @__PURE__ */ new Map(),
      errors: [],
      startTime: Date.now()
    };
    const completedSteps = /* @__PURE__ */ new Set();
    const executionOrder = Graph.alg.topsort(graph);
    for (const stepId of executionOrder) {
      const step = steps.get(stepId);
      if (!step) {
        context.errors.push({
          stepId,
          error: `Step ${stepId} not found`,
          recoverable: false
        });
        continue;
      }
      try {
        const result = await executeStep(
          step,
          context,
          this.config,
          this.customTools
        );
        context.stepResults.set(stepId, result);
        completedSteps.add(stepId);
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        context.errors.push({
          stepId,
          error: errorMessage,
          recoverable: step.retries > 0
        });
        if (step.retries === 0) {
          break;
        }
      }
    }
    return context;
  }
  /**
   * Execute with parallel processing for independent steps
   */
  async executeParallel(graph, steps) {
    const context = {
      stepResults: /* @__PURE__ */ new Map(),
      errors: [],
      startTime: Date.now()
    };
    const completedSteps = /* @__PURE__ */ new Set();
    const pendingSteps = new Set(steps.keys());
    while (pendingSteps.size > 0) {
      const readySteps = [];
      for (const stepId of pendingSteps) {
        const step = steps.get(stepId);
        if (!step) continue;
        const allDepsCompleted = step.dependencies.every(
          (dep) => completedSteps.has(dep)
        );
        if (allDepsCompleted) {
          readySteps.push(step);
        }
      }
      if (readySteps.length === 0) {
        break;
      }
      const executions = readySteps.map(async (step) => {
        pendingSteps.delete(step.stepId);
        try {
          const result = await executeStep(
            step,
            context,
            this.config,
            this.customTools
          );
          context.stepResults.set(step.stepId, result);
          completedSteps.add(step.stepId);
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : String(error);
          context.errors.push({
            stepId: step.stepId,
            error: errorMessage,
            recoverable: step.retries > 0
          });
          completedSteps.add(step.stepId);
        }
      });
      await Promise.all(executions);
    }
    return context;
  }
  /**
   * Convert execution context to pipeline result
   */
  toPipelineResult(context, userIntent, executionGraph) {
    const endTime = Date.now();
    const hasErrors = context.errors.length > 0;
    const allStepsCompleted = context.stepResults.size === executionGraph.length;
    let status = "success";
    if (hasErrors && !allStepsCompleted) {
      status = "failed";
    } else if (hasErrors) {
      status = "partial";
    }
    const results = {};
    for (const [stepId, result] of context.stepResults) {
      results[stepId] = result;
    }
    return {
      pipelineId: crypto.randomUUID(),
      userIntent,
      executionGraph,
      results,
      errors: context.errors,
      metadata: {
        startTime: context.startTime,
        endTime,
        duration: endTime - context.startTime,
        llmUsed: false,
        fallbackUsed: false,
        circuitBreakerOpen: false
      },
      status
    };
  }
}
const DEFAULT_CONFIG = {
  providers: [],
  fallbackEnabled: true,
  circuitBreakerThreshold: 5,
  circuitBreakerResetTimeout: 6e4
};
class CircuitBreaker {
  state = /* @__PURE__ */ new Map();
  threshold;
  resetTimeout;
  constructor(threshold, resetTimeout) {
    this.threshold = threshold;
    this.resetTimeout = resetTimeout;
  }
  getState(providerId) {
    const existing = this.state.get(providerId);
    if (existing) {
      if (existing.state === "open" && existing.nextRetryTime && Date.now() >= existing.nextRetryTime) {
        const updated = {
          ...existing,
          state: "half_open",
          nextRetryTime: void 0
        };
        this.state.set(providerId, updated);
        return updated;
      }
      return existing;
    }
    const initialState = {
      providerId,
      state: "closed",
      failures: 0,
      successes: 0,
      threshold: this.threshold,
      resetTimeout: this.resetTimeout
    };
    this.state.set(providerId, initialState);
    return initialState;
  }
  recordSuccess(providerId) {
    const current = this.getState(providerId);
    const updated = {
      ...current,
      failures: 0,
      successes: current.successes + 1,
      state: current.state === "half_open" ? "closed" : current.state
    };
    this.state.set(providerId, updated);
  }
  recordFailure(providerId) {
    const current = this.getState(providerId);
    const failures = current.failures + 1;
    let newState = current.state;
    let nextRetryTime;
    if (failures >= this.threshold) {
      newState = "open";
      nextRetryTime = Date.now() + this.resetTimeout;
    } else if (current.state === "half_open") {
      newState = "open";
      nextRetryTime = Date.now() + this.resetTimeout;
    }
    const updated = {
      ...current,
      failures,
      successes: 0,
      state: newState,
      lastFailureTime: Date.now(),
      nextRetryTime
    };
    this.state.set(providerId, updated);
  }
  isOpen(providerId) {
    const state = this.getState(providerId);
    return state.state === "open";
  }
  getAllStates() {
    return new Map(this.state);
  }
}
function defaultTemplateRenderer(data) {
  const formatValue = (value) => {
    if (value === null || value === void 0) return "N/A";
    if (typeof value === "object") {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  };
  let output = `# Research Results

`;
  output += `Generated: ${(/* @__PURE__ */ new Date()).toISOString()}

`;
  output += `---

`;
  for (const [key, value] of Object.entries(data)) {
    output += `## ${key}

`;
    output += `${formatValue(value)}

`;
  }
  output += `---

`;
  output += `*This response was generated using the deterministic template renderer.*
`;
  return output;
}
class Synthesizer {
  config;
  circuitBreaker;
  currentProviderIndex;
  constructor(config) {
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.circuitBreaker = new CircuitBreaker(
      this.config.circuitBreakerThreshold,
      this.config.circuitBreakerResetTimeout
    );
    this.currentProviderIndex = 0;
  }
  /**
   * Register an LLM provider
   */
  registerProvider(provider) {
    this.config.providers.push(provider);
  }
  /**
   * Get available provider (respecting circuit breaker)
   */
  getAvailableProvider() {
    if (this.config.providers.length === 0) {
      return null;
    }
    for (let i = 0; i < this.config.providers.length; i++) {
      const index = (this.currentProviderIndex + i) % this.config.providers.length;
      const provider = this.config.providers[index];
      if (!this.circuitBreaker.isOpen(provider.id)) {
        this.currentProviderIndex = index;
        return provider;
      }
    }
    return null;
  }
  /**
   * Synthesize results using LLM or fallback
   */
  async synthesize(context, prompt) {
    const provider = this.getAvailableProvider();
    if (!provider || !this.config.fallbackEnabled) {
      const renderer = this.config.templateRenderer || defaultTemplateRenderer;
      return {
        content: renderer(context),
        llmUsed: false,
        fallbackUsed: true
      };
    }
    try {
      const fullPrompt = `${prompt}

Context:
${JSON.stringify(context, null, 2)}`;
      const result = await provider.generate(fullPrompt);
      this.circuitBreaker.recordSuccess(provider.id);
      return {
        content: result,
        llmUsed: true,
        fallbackUsed: false
      };
    } catch (error) {
      console.error(`LLM provider ${provider.id} failed:`, error);
      this.circuitBreaker.recordFailure(provider.id);
      return this.synthesize(context, prompt);
    }
  }
  /**
   * Generate response with automatic fallback
   */
  async generateWithFallback(query, context) {
    const startTime = Date.now();
    let llmUsed = false;
    let fallbackUsed = false;
    let circuitBreakerOpen = false;
    try {
      const prompt = `Based on the following query, provide a comprehensive response:

Query: ${query}`;
      const result = await this.synthesize(context || {}, prompt);
      llmUsed = result.llmUsed;
      fallbackUsed = result.fallbackUsed;
      return {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        llmUsed,
        fallbackUsed,
        circuitBreakerOpen
      };
    } catch (error) {
      circuitBreakerOpen = true;
      return {
        startTime,
        endTime: Date.now(),
        duration: Date.now() - startTime,
        llmUsed: false,
        fallbackUsed: true,
        circuitBreakerOpen
      };
    }
  }
  /**
   * Get circuit breaker states for monitoring
   */
  getCircuitBreakerStates() {
    return this.circuitBreaker.getAllStates();
  }
  /**
   * Reset circuit breaker for a specific provider
   */
  resetCircuitBreaker(providerId) {
    const current = this.circuitBreaker.getState(providerId);
    this.circuitBreaker.recordSuccess(providerId);
    const updated = {
      ...current,
      state: "closed",
      failures: 0,
      nextRetryTime: void 0
    };
    const states = this.circuitBreaker.getAllStates();
    states.set(providerId, updated);
  }
  /**
   * Check if any LLM providers are available
   */
  hasAvailableProviders() {
    return this.getAvailableProvider() !== null;
  }
}
function createLLMProvider(id, name, apiEndpoint, apiKeyEnvVar, options) {
  return {
    id,
    name,
    model: options?.model,
    maxTokens: options?.maxTokens,
    generate: async (prompt) => {
      const apiKey = process.env[apiKeyEnvVar];
      if (!apiKey) {
        throw new Error(`API key not found for provider ${id}. Set ${apiKeyEnvVar} environment variable.`);
      }
      const response = await fetch(apiEndpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model: options?.model,
          messages: [{ role: "user", content: prompt }],
          max_tokens: options?.maxTokens || 1e3
        })
      });
      if (!response.ok) {
        throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
      }
      const data = await response.json();
      return data.choices?.[0]?.message?.content || "";
    }
  };
}
let globalSynthesizer = null;
function getGlobalSynthesizer(config) {
  if (!globalSynthesizer) {
    globalSynthesizer = new Synthesizer(config);
  }
  return globalSynthesizer;
}
const POST = async ({ request, platform }) => {
  const startTime = Date.now();
  try {
    const body = await request.json();
    const { query, options = {} } = body;
    if (!query || typeof query !== "string") {
      return json(
        { error: "Missing or invalid query parameter" },
        { status: 400 }
      );
    }
    if (query.length > 2e3) {
      return json(
        { error: "Query exceeds maximum length of 2000 characters" },
        { status: 400 }
      );
    }
    const intentId = crypto.randomUUID();
    const intent = createIntentFromQuery(query, intentId, {
      llmFallbackEnabled: options.llmFallback ?? false,
      minConfidenceThreshold: options.confidenceThreshold ?? 0.7
    });
    if (intent.confidence < 0.5 && options.llmFallback) {
      intent.category = "unknown";
    }
    const plannedGraph = buildDAG(intent);
    const executionOrder = getExecutionOrder(plannedGraph);
    const executionGraph = Array.from(plannedGraph.steps.values());
    const executor = new DAGExecutor({
      maxRetries: options.maxRetries ?? 2,
      defaultTimeout: options.timeout ?? 3e4,
      enableSanitization: options.sanitize ?? true,
      parallelExecution: options.parallel ?? true
    });
    const context = options.parallel ? await executor.executeParallel(plannedGraph.graph, plannedGraph.steps) : await executor.execute(plannedGraph.graph, plannedGraph.steps);
    let result = executor.toPipelineResult(context, intent, executionGraph);
    if (intent.category === "synthesis" || intent.category === "analysis") {
      const synthesizer = getGlobalSynthesizer({
        fallbackEnabled: true,
        circuitBreakerThreshold: 5,
        circuitBreakerResetTimeout: 6e4
      });
      const llmEndpoint = process.env.LLM_API_ENDPOINT;
      const llmApiKey = process.env.LLM_API_KEY;
      if (llmEndpoint && llmApiKey && !synthesizer.hasAvailableProviders()) {
        const provider = createLLMProvider(
          "default",
          "Default LLM Provider",
          llmEndpoint,
          "LLM_API_KEY",
          { model: process.env.LLM_MODEL || "gpt-3.5-turbo" }
        );
        synthesizer.registerProvider(provider);
      }
      const synthesisPrompt = `Synthesize the following research results into a coherent summary.`;
      const synthesisResult = await synthesizer.synthesize(
        context.stepResults,
        synthesisPrompt
      );
      result.metadata.llmUsed = synthesisResult.llmUsed;
      result.metadata.fallbackUsed = synthesisResult.fallbackUsed;
      result.results["synthesis"] = {
        content: synthesisResult.content,
        timestamp: Date.now()
      };
    }
    result.metadata.endTime = Date.now();
    result.metadata.duration = result.metadata.endTime - startTime;
    const validatedResult = PipelineResultSchema.parse(result);
    try {
      await fetch("/api/pipeline", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: validatedResult.pipelineId,
          result: validatedResult
        })
      });
    } catch (cacheError) {
      console.warn("Failed to cache pipeline result:", cacheError);
    }
    return json(validatedResult, { status: 200 });
  } catch (error) {
    console.error("Pipeline execution failed:", error);
    const errorMessage = error instanceof Error ? error.message : "Unknown error occurred";
    const isValidationError = error?.constructor?.name === "ZodError";
    return json(
      {
        error: errorMessage,
        type: isValidationError ? "validation_error" : "execution_error",
        timestamp: Date.now()
      },
      {
        status: isValidationError ? 400 : 500
      }
    );
  }
};
const GET = async () => {
  const status = {
    status: "healthy",
    timestamp: Date.now(),
    version: "0.1.0",
    layers: {
      router: "operational",
      planner: "operational",
      executor: "operational",
      sanitizer: "operational",
      synthesizer: "operational"
    },
    environment: {
      llmConfigured: !!process.env.LLM_API_ENDPOINT,
      workerPoolConfigured: !!process.env.WORKER_SCRIPT_PATH
    }
  };
  return json(status, { status: 200 });
};
export {
  GET,
  POST
};
