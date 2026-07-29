import { z } from 'zod';

// ============================================
// LAYER 1: User Intent Schema
// ============================================
export const UserIntentSchema = z.object({
	intentId: z.string().uuid(),
	rawQuery: z.string().min(1).max(2000),
	category: z.enum([
		'search',
		'calculation',
		'analysis',
		'synthesis',
		'verification',
		'unknown'
	]),
	confidence: z.number().min(0).max(1),
	parameters: z.record(z.string(), z.unknown()).optional(),
	timestamp: z.number()
});

export type UserIntent = z.infer<typeof UserIntentSchema>;

// ============================================
// LAYER 2: Task Step Schema (DAG Node)
// ============================================
export const TaskStepSchema = z.object({
	stepId: z.string().uuid(),
	toolType: z.enum([
		'search',
		'calculator',
		'solver',
		'validator',
		'synthesizer',
		'template_renderer'
	]),
	description: z.string(),
	dependencies: z.array(z.string()).default([]), // References to other stepIds
	inputVariables: z.array(z.string()).default([]), // Variables like $1, $2 to resolve
	outputSchema: z.record(z.string(), z.unknown()).optional(),
	timeout: z.number().default(30000),
	retries: z.number().default(2),
	priority: z.number().default(0)
});

export type TaskStep = z.infer<typeof TaskStepSchema>;

// ============================================
// Tool Interface Schema
// ============================================
export const ToolInterfaceSchema = z.object({
	toolId: z.string(),
	name: z.string(),
	version: z.string(),
	description: z.string(),
	inputSchema: z.record(z.string(), z.unknown()),
	outputSchema: z.record(z.string(), z.unknown()),
	executionMode: z.enum(['sync', 'worker_thread', 'child_process']),
	memoryIsolation: z.boolean().default(false),
	maxMemoryMB: z.number().optional()
});

export type ToolInterface = z.infer<typeof ToolInterfaceSchema>;

// ============================================
// Pipeline Result Schema
// ============================================
export const PipelineResultSchema = z.object({
	pipelineId: z.string().uuid(),
	userIntent: UserIntentSchema,
	executionGraph: z.array(TaskStepSchema),
	results: z.record(z.string(), z.unknown()), // stepId -> result
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
	status: z.enum(['success', 'partial', 'failed'])
});

export type PipelineResult = z.infer<typeof PipelineResultSchema>;

// ============================================
// Sanitized Data Schema (Layer 4 output)
// ============================================
export const SanitizedDataSchema = z.object({
	source: z.string(),
	rawContent: z.string(),
	sanitizedContent: z.string(),
	injectionAttempts: z.array(z.string()).default([]),
	trustScore: z.number().min(0).max(1),
	timestamp: z.number()
});

export type SanitizedData = z.infer<typeof SanitizedDataSchema>;

// ============================================
// Circuit Breaker State Schema
// ============================================
export const CircuitBreakerStateSchema = z.object({
	providerId: z.string(),
	state: z.enum(['closed', 'open', 'half_open']),
	failures: z.number().default(0),
	successes: z.number().default(0),
	lastFailureTime: z.number().optional(),
	nextRetryTime: z.number().optional(),
	threshold: z.number().default(5),
	resetTimeout: z.number().default(60000)
});

export type CircuitBreakerState = z.infer<typeof CircuitBreakerStateSchema>;

// ============================================
// Worker Pool Task Schema
// ============================================
export const WorkerTaskSchema = z.object({
	taskId: z.string().uuid(),
	toolType: z.string(),
	payload: z.record(z.string(), z.unknown()),
	priority: z.number().default(0),
	timeout: z.number().default(30000)
});

export type WorkerTask = z.infer<typeof WorkerTaskSchema>;

export const WorkerResultSchema = z.object({
	taskId: z.string(),
	success: z.boolean(),
	result: z.unknown().optional(),
	error: z.string().optional(),
	executionTime: z.number(),
	memoryUsed: z.number().optional()
});

export type WorkerResult = z.infer<typeof WorkerResultSchema>;
