import { json } from '@sveltejs/kit';
import type { RequestHandler, RequestEvent } from './$types';
import { UserIntentSchema, PipelineResultSchema } from '$lib/types/pipeline';
import { createIntentFromQuery, routeIntent } from '$lib/orchestrator/router';
import { buildDAG, getExecutionOrder } from '$lib/orchestrator/planner';
import { DAGExecutor } from '$lib/orchestrator/executor';
import { getGlobalSynthesizer, createLLMProvider } from '$lib/orchestrator/synthesizer';

/**
 * POST /api/research
 * Main pipeline endpoint orchestrating the 5-layer research system
 * 
 * Flow:
 * 1. Router (Layer 1) - Intent classification via regex
 * 2. Planner (Layer 2) - DAG construction with variable resolution
 * 3. Executor (Layer 3) - Topological execution with sanitization
 * 4. Sanitizer (Layer 4) - Input validation for external data
 * 5. Synthesizer (Layer 5) - LLM synthesis with circuit breaker fallback
 */
export const POST: RequestHandler = async ({ request, platform }) => {
	const startTime = Date.now();
	
	try {
		// Parse request body
		const body = await request.json();
		const { query, options = {} } = body;

		if (!query || typeof query !== 'string') {
			return json(
				{ error: 'Missing or invalid query parameter' },
				{ status: 400 }
			);
		}

		if (query.length > 2000) {
			return json(
				{ error: 'Query exceeds maximum length of 2000 characters' },
				{ status: 400 }
			);
		}

		// Generate intent ID
		const intentId = crypto.randomUUID();

		// ============================================
		// LAYER 1: ROUTER
		// ============================================
		const intent = createIntentFromQuery(query, intentId, {
			llmFallbackEnabled: options.llmFallback ?? false,
			minConfidenceThreshold: options.confidenceThreshold ?? 0.7
		});

		// If confidence is too low and LLM fallback is enabled
		if (intent.confidence < 0.5 && options.llmFallback) {
			// In production, this would call an SLM/LLM for better routing
			// For now, we proceed with the regex result
			intent.category = 'unknown';
		}

		// ============================================
		// LAYER 2: PLANNER
		// ============================================
		const plannedGraph = buildDAG(intent);
		const executionOrder = getExecutionOrder(plannedGraph);

		// Convert graph to array for response
		const executionGraph = Array.from(plannedGraph.steps.values());

		// ============================================
		// LAYER 3: EXECUTOR
		// ============================================
		const executor = new DAGExecutor({
			maxRetries: options.maxRetries ?? 2,
			defaultTimeout: options.timeout ?? 30000,
			enableSanitization: options.sanitize ?? true,
			parallelExecution: options.parallel ?? true
		});

		// Execute the DAG
		const context = options.parallel
			? await executor.executeParallel(plannedGraph.graph, plannedGraph.steps)
			: await executor.execute(plannedGraph.graph, plannedGraph.steps);

		// Convert to pipeline result
		let result = executor.toPipelineResult(context, intent, executionGraph);

		// ============================================
		// LAYER 5: SYNTHESIZER (if needed)
		// ============================================
		if (intent.category === 'synthesis' || intent.category === 'analysis') {
			const synthesizer = getGlobalSynthesizer({
				fallbackEnabled: true,
				circuitBreakerThreshold: 5,
				circuitBreakerResetTimeout: 60000
			});

			// Initialize LLM providers from environment if available
			const llmEndpoint = process.env.LLM_API_ENDPOINT;
			const llmApiKey = process.env.LLM_API_KEY;
			
			if (llmEndpoint && llmApiKey && !synthesizer.hasAvailableProviders()) {
				const provider = createLLMProvider(
					'default',
					'Default LLM Provider',
					llmEndpoint,
					'LLM_API_KEY',
					{ model: process.env.LLM_MODEL || 'gpt-3.5-turbo' }
				);
				synthesizer.registerProvider(provider);
			}

			// Synthesize results
			const synthesisPrompt = `Synthesize the following research results into a coherent summary.`;
			const synthesisResult = await synthesizer.synthesize(
				context.stepResults as Record<string, unknown>,
				synthesisPrompt
			);

			// Update result metadata
			result.metadata.llmUsed = synthesisResult.llmUsed;
			result.metadata.fallbackUsed = synthesisResult.fallbackUsed;

			// Add synthesis to results
			result.results['synthesis'] = {
				content: synthesisResult.content,
				timestamp: Date.now()
			};
		}

		// Finalize metadata
		result.metadata.endTime = Date.now();
		result.metadata.duration = result.metadata.endTime - startTime;

		// Validate result schema
		const validatedResult = PipelineResultSchema.parse(result);

		// Store in pipeline cache for later retrieval
		try {
			await fetch('/api/pipeline', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					pipelineId: validatedResult.pipelineId,
					result: validatedResult
				})
			});
		} catch (cacheError) {
			console.warn('Failed to cache pipeline result:', cacheError);
		}

		return json(validatedResult, { status: 200 });
	} catch (error) {
		console.error('Pipeline execution failed:', error);
		
		const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
		const isValidationError = error?.constructor?.name === 'ZodError';
		
		return json(
			{
				error: errorMessage,
				type: isValidationError ? 'validation_error' : 'execution_error',
				timestamp: Date.now()
			},
			{
				status: isValidationError ? 400 : 500
			}
		);
	}
};

/**
 * GET /api/research
 * Health check and system status
 */
export const GET: RequestHandler = async () => {
	const status = {
		status: 'healthy',
		timestamp: Date.now(),
		version: '0.1.0',
		layers: {
			router: 'operational',
			planner: 'operational',
			executor: 'operational',
			sanitizer: 'operational',
			synthesizer: 'operational'
		},
		environment: {
			llmConfigured: !!process.env.LLM_API_ENDPOINT,
			workerPoolConfigured: !!process.env.WORKER_SCRIPT_PATH
		}
	};

	return json(status, { status: 200 });
};
