import Graph from 'graphlib';
import type { TaskStep, SanitizedData, PipelineResult } from '$lib/types/pipeline';
import { sanitizeInput } from './sanitizer';

/**
 * Layer 3: DAG Topological Executor
 * Executes steps in dependency order with dynamic tool resolution
 */

export interface ExecutionContext {
	stepResults: Map<string, unknown>;
	errors: Array<{ stepId: string; error: string; recoverable: boolean }>;
	startTime: number;
}

export interface ToolHandler {
	execute: (input: unknown, context?: ExecutionContext) => Promise<unknown>;
	validate?: (output: unknown) => boolean;
}

export interface ExecutorConfig {
	maxRetries: number;
	defaultTimeout: number;
	enableSanitization: boolean;
	parallelExecution: boolean;
}

const DEFAULT_CONFIG: ExecutorConfig = {
	maxRetries: 2,
	defaultTimeout: 30000,
	enableSanitization: true,
	parallelExecution: true
};

/**
 * Built-in tool handlers for deterministic operations
 */
const TOOL_HANDLERS: Record<string, ToolHandler> = {
	search: {
		execute: async (input: unknown) => {
			// Placeholder for actual search implementation
			// In production, this would call external search APIs
			const query = typeof input === 'string' ? input : JSON.stringify(input);
			
			// Simulate search result
			return {
				query,
				results: [
					{ title: `Result for: ${query}`, content: 'Sample content', url: 'https://example.com' }
				],
				timestamp: Date.now()
			};
		},
		validate: (output: unknown): boolean => {
			return output !== null && output !== undefined;
		}
	},
	calculator: {
		execute: async (input: unknown) => {
			if (typeof input !== 'object' || input === null) {
				throw new Error('Calculator requires object input with numbers and operator');
			}
			
			const calcInput = input as { numbers?: number[]; operator?: string };
			const numbers = calcInput.numbers || [];
			const operator = calcInput.operator || '+';
			
			if (numbers.length < 2) {
				throw new Error('Calculator requires at least 2 numbers');
			}
			
			let result = numbers[0];
			for (let i = 1; i < numbers.length; i++) {
				switch (operator) {
					case '+':
						result += numbers[i];
						break;
					case '-':
						result -= numbers[i];
						break;
					case '*':
						result *= numbers[i];
						break;
					case '/':
						if (numbers[i] === 0) {
							throw new Error('Division by zero');
						}
						result /= numbers[i];
						break;
					default:
						throw new Error(`Unknown operator: ${operator}`);
				}
			}
			
			return { result, expression: `${numbers.join(` ${operator} `)}` };
		},
		validate: (output: unknown): boolean => {
			return (
				output !== null &&
				output !== undefined &&
				typeof output === 'object' &&
				'result' in output
			);
		}
	},
	solver: {
		execute: async (input: unknown, context?: ExecutionContext) => {
			// Placeholder for Z3 solver or other constraint solvers
			// This would typically use child_process.fork for memory isolation
			return {
				input,
				solution: 'Solved via constraint logic',
				timestamp: Date.now()
			};
		},
		validate: (output: unknown): boolean => {
			return output !== null && output !== undefined;
		}
	},
	validator: {
		execute: async (input: unknown) => {
			// Validate previous step output
			return {
				valid: input !== null && input !== undefined,
				input,
				timestamp: Date.now()
			};
		},
		validate: (output: unknown): boolean => {
			return (
				output !== null &&
				output !== undefined &&
				typeof output === 'object' &&
				'valid' in output
			);
		}
	},
	synthesizer: {
		execute: async (input: unknown, context?: ExecutionContext) => {
			// Synthesize results from multiple sources
			// This is where LLM would be used as a synthesizer
			return {
				input,
				synthesis: 'Synthesized output from multiple sources',
				timestamp: Date.now()
			};
		},
		validate: (output: unknown): boolean => {
			return output !== null && output !== undefined;
		}
	},
	template_renderer: {
		execute: async (input: unknown) => {
			// Pure TypeScript/JS template renderer fallback
			const data = typeof input === 'object' ? input : { value: input };
			
			const template = `
# Research Results
Generated: ${new Date().toISOString()}

## Data
${JSON.stringify(data, null, 2)}
`.trim();
			
			return {
				rendered: template,
				format: 'markdown',
				timestamp: Date.now()
			};
		},
		validate: (output: unknown): boolean => {
			return (
				output !== null &&
				output !== undefined &&
				typeof output === 'object' &&
				'rendered' in output
			);
		}
	}
};

/**
 * Execute a single step with retry logic and sanitization
 */
async function executeStep(
	step: TaskStep,
	context: ExecutionContext,
	config: ExecutorConfig,
	customTools?: Record<string, ToolHandler>
): Promise<unknown> {
	const tools = { ...TOOL_HANDLERS, ...customTools };
	const handler = tools[step.toolType];
	
	if (!handler) {
		throw new Error(`Unknown tool type: ${step.toolType}`);
	}
	
	// Resolve input variables from previous step results
	const resolvedInput = resolveStepInput(step, context.stepResults);
	
	// Sanitize input if enabled
	let sanitizedInput = resolvedInput;
	if (config.enableSanitization && typeof resolvedInput === 'string') {
		const sanitized: SanitizedData = await sanitizeInput(resolvedInput, 'user_input');
		sanitizedInput = sanitized.sanitizedContent;
	}
	
	// Execute with timeout and retries
	let lastError: Error | null = null;
	const maxAttempts = step.retries || config.maxRetries;
	const timeout = step.timeout || config.defaultTimeout;
	
	for (let attempt = 0; attempt < maxAttempts; attempt++) {
		try {
			const controller = new AbortController();
			const timeoutId = setTimeout(() => controller.abort(), timeout);
			
			try {
				const result = await Promise.race([
					handler.execute(sanitizedInput, context),
					new Promise<never>((_, reject) => {
						controller.signal.addEventListener('abort', () => {
							reject(new Error(`Step ${step.stepId} timed out after ${timeout}ms`));
						});
					})
				]);
				
				clearTimeout(timeoutId);
				
				// Validate output if validator exists
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
				// Exponential backoff
				await sleep(Math.pow(2, attempt) * 1000);
			}
		}
	}
	
	throw lastError || new Error(`Step ${step.stepId} failed after ${maxAttempts} attempts`);
}

/**
 * Resolve step input from variables and previous results
 */
function resolveStepInput(step: TaskStep, results: Map<string, unknown>): unknown {
	if (step.inputVariables.length === 0) {
		return null;
	}
	
	// If only one variable, return its value directly
	if (step.inputVariables.length === 1) {
		const varName = step.inputVariables[0];
		const depResult = results.get(varName);
		if (depResult !== undefined) {
			return depResult;
		}
		return varName; // Return literal if not found in results
	}
	
	// Multiple variables: return as object
	const inputObj: Record<string, unknown> = {};
	for (const varName of step.inputVariables) {
		const depResult = results.get(varName);
		inputObj[varName] = depResult !== undefined ? depResult : varName;
	}
	
	return inputObj;
}

/**
 * Sleep utility
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Main executor class
 */
export class DAGExecutor {
	private config: ExecutorConfig;
	private customTools: Record<string, ToolHandler>;
	
	constructor(config?: Partial<ExecutorConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.customTools = {};
	}
	
	/**
	 * Register a custom tool handler
	 */
	registerTool(toolType: string, handler: ToolHandler): void {
		this.customTools[toolType] = handler;
	}
	
	/**
	 * Execute the entire DAG
	 */
	async execute(
		graph: Graph.Graph,
		steps: Map<string, TaskStep>
	): Promise<ExecutionContext> {
		const context: ExecutionContext = {
			stepResults: new Map(),
			errors: [],
			startTime: Date.now()
		};
		
		const completedSteps = new Set<string>();
		const executionOrder = Graph.alg.topsort(graph);
		
		// Execute in topological order
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
				
				// If not recoverable, stop execution
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
	async executeParallel(
		graph: Graph.Graph,
		steps: Map<string, TaskStep>
	): Promise<ExecutionContext> {
		const context: ExecutionContext = {
			stepResults: new Map(),
			errors: [],
			startTime: Date.now()
		};
		
		const completedSteps = new Set<string>();
		const pendingSteps = new Set(steps.keys());
		
		while (pendingSteps.size > 0) {
			// Find all ready steps (dependencies satisfied)
			const readySteps: TaskStep[] = [];
			
			for (const stepId of pendingSteps) {
				const step = steps.get(stepId);
				if (!step) continue;
				
				const allDepsCompleted = step.dependencies.every((dep) =>
					completedSteps.has(dep)
				);
				
				if (allDepsCompleted) {
					readySteps.push(step);
				}
			}
			
			if (readySteps.length === 0) {
				// No progress possible - likely due to errors
				break;
			}
			
			// Execute ready steps in parallel
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
					completedSteps.add(step.stepId); // Mark as completed to avoid infinite loop
				}
			});
			
			await Promise.all(executions);
		}
		
		return context;
	}
	
	/**
	 * Convert execution context to pipeline result
	 */
	toPipelineResult(
		context: ExecutionContext,
		userIntent: import('$lib/types/pipeline').UserIntent,
		executionGraph: TaskStep[]
	): PipelineResult {
		const endTime = Date.now();
		const hasErrors = context.errors.length > 0;
		const allStepsCompleted = context.stepResults.size === executionGraph.length;
		
		let status: PipelineResult['status'] = 'success';
		if (hasErrors && !allStepsCompleted) {
			status = 'failed';
		} else if (hasErrors) {
			status = 'partial';
		}
		
		const results: Record<string, unknown> = {};
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
