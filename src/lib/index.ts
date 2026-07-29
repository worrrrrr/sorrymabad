import { buildDAG } from '$lib/orchestrator/planner';
import { DAGExecutor } from '$lib/orchestrator/executor';
import { routeIntent, createIntentFromQuery, llmRouteFallback } from '$lib/orchestrator/router';
import { sanitizeInput, sanitizeMultipleInputs, isContentSafe, createSanitizationMiddleware, detectInjectionAttempts, calculateTrustScore } from '$lib/orchestrator/sanitizer';
import { Synthesizer, createLLMProvider, getGlobalSynthesizer, destroyGlobalSynthesizer } from '$lib/orchestrator/synthesizer';
import { HeavyWorkerPool, getGlobalWorkerPool, destroyGlobalWorkerPool } from '$lib/orchestrator/heavy-worker-pool';

// Export types
export type {
	UserIntent,
	TaskStep,
	ToolInterface,
	PipelineResult,
	SanitizedData,
	CircuitBreakerState,
	WorkerTask,
	WorkerResult
} from '$lib/types/pipeline';

// Export Layer 1: Router
export { routeIntent, createIntentFromQuery, llmRouteFallback };
export type { RouteMatch, RouterConfig } from '$lib/orchestrator/router';

// Export Layer 2: Planner
export { buildDAG, getExecutionOrder, getReadySteps, resolveVariables };
export type { PlannedGraph, PlanningRule } from '$lib/orchestrator/planner';

// Export Layer 3: Executor
export { DAGExecutor };
export type { ExecutionContext, ToolHandler, ExecutorConfig } from '$lib/orchestrator/executor';

// Export Layer 4: Sanitizer
export {
	sanitizeInput,
	sanitizeMultipleInputs,
	isContentSafe,
	createSanitizationMiddleware,
	detectInjectionAttempts,
	calculateTrustScore
};
export type { SanitizationConfig } from '$lib/orchestrator/sanitizer';

// Export Layer 5: Synthesizer
export {
	Synthesizer,
	createLLMProvider,
	getGlobalSynthesizer,
	destroyGlobalSynthesizer
};
export type { LLMProvider, SynthesizerConfig } from '$lib/orchestrator/synthesizer';

// Export Heavy Worker Pool
export {
	HeavyWorkerPool,
	getGlobalWorkerPool,
	destroyGlobalWorkerPool
};
export type { WorkerPoolConfig, WorkerInfo, PoolStats } from '$lib/orchestrator/heavy-worker-pool';
