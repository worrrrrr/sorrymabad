import type { CircuitBreakerState, PipelineResult } from '$lib/types/pipeline';

/**
 * Layer 5: Synthesizer & Fallback
 * Circuit-breaker aware LLM handler with pure TypeScript/JS fallback
 */

export interface LLMProvider {
	id: string;
	name: string;
	generate: (prompt: string) => Promise<string>;
	maxTokens?: number;
	model?: string;
}

export interface SynthesizerConfig {
	providers: LLMProvider[];
	fallbackEnabled: boolean;
	circuitBreakerThreshold: number;
	circuitBreakerResetTimeout: number;
	templateRenderer?: (data: Record<string, unknown>) => string;
}

const DEFAULT_CONFIG: SynthesizerConfig = {
	providers: [],
	fallbackEnabled: true,
	circuitBreakerThreshold: 5,
	circuitBreakerResetTimeout: 60000
};

/**
 * Circuit Breaker implementation for LLM providers
 */
class CircuitBreaker {
	private state: Map<string, CircuitBreakerState> = new Map();
	private threshold: number;
	private resetTimeout: number;

	constructor(threshold: number, resetTimeout: number) {
		this.threshold = threshold;
		this.resetTimeout = resetTimeout;
	}

	getState(providerId: string): CircuitBreakerState {
		const existing = this.state.get(providerId);
		if (existing) {
			// Check if we should transition from open to half_open
			if (
				existing.state === 'open' &&
				existing.nextRetryTime &&
				Date.now() >= existing.nextRetryTime
			) {
				const updated: CircuitBreakerState = {
					...existing,
					state: 'half_open',
					nextRetryTime: undefined
				};
				this.state.set(providerId, updated);
				return updated;
			}
			return existing;
		}

		const initialState: CircuitBreakerState = {
			providerId,
			state: 'closed',
			failures: 0,
			successes: 0,
			threshold: this.threshold,
			resetTimeout: this.resetTimeout
		};
		this.state.set(providerId, initialState);
		return initialState;
	}

	recordSuccess(providerId: string): void {
		const current = this.getState(providerId);
		const updated: CircuitBreakerState = {
			...current,
			failures: 0,
			successes: current.successes + 1,
			state: current.state === 'half_open' ? 'closed' : current.state
		};
		this.state.set(providerId, updated);
	}

	recordFailure(providerId: string): void {
		const current = this.getState(providerId);
		const failures = current.failures + 1;

		let newState: CircuitBreakerState['state'] = current.state;
		let nextRetryTime: number | undefined;

		if (failures >= this.threshold) {
			newState = 'open';
			nextRetryTime = Date.now() + this.resetTimeout;
		} else if (current.state === 'half_open') {
			newState = 'open';
			nextRetryTime = Date.now() + this.resetTimeout;
		}

		const updated: CircuitBreakerState = {
			...current,
			failures,
			successes: 0,
			state: newState,
			lastFailureTime: Date.now(),
			nextRetryTime
		};
		this.state.set(providerId, updated);
	}

	isOpen(providerId: string): boolean {
		const state = this.getState(providerId);
		return state.state === 'open';
	}

	getAllStates(): Map<string, CircuitBreakerState> {
		return new Map(this.state);
	}
}

/**
 * Default template renderer fallback
 * Pure TypeScript/JS - no LLM required
 */
function defaultTemplateRenderer(data: Record<string, unknown>): string {
	const formatValue = (value: unknown): string => {
		if (value === null || value === undefined) return 'N/A';
		if (typeof value === 'object') {
			return JSON.stringify(value, null, 2);
		}
		return String(value);
	};

	let output = `# Research Results\n\n`;
	output += `Generated: ${new Date().toISOString()}\n\n`;
	output += `---\n\n`;

	for (const [key, value] of Object.entries(data)) {
		output += `## ${key}\n\n`;
		output += `${formatValue(value)}\n\n`;
	}

	output += `---\n\n`;
	output += `*This response was generated using the deterministic template renderer.*\n`;

	return output;
}

/**
 * Main Synthesizer class
 * Manages LLM providers with circuit breaker and fallback
 */
export class Synthesizer {
	private config: SynthesizerConfig;
	private circuitBreaker: CircuitBreaker;
	private currentProviderIndex: number;

	constructor(config?: Partial<SynthesizerConfig>) {
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
	registerProvider(provider: LLMProvider): void {
		this.config.providers.push(provider);
	}

	/**
	 * Get available provider (respecting circuit breaker)
	 */
	private getAvailableProvider(): LLMProvider | null {
		if (this.config.providers.length === 0) {
			return null;
		}

		// Try each provider starting from current index
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
	async synthesize(
		context: Record<string, unknown>,
		prompt: string
	): Promise<{ content: string; llmUsed: boolean; fallbackUsed: boolean }> {
		const provider = this.getAvailableProvider();

		// No LLM available or all circuits open - use fallback
		if (!provider || !this.config.fallbackEnabled) {
			const renderer = this.config.templateRenderer || defaultTemplateRenderer;
			return {
				content: renderer(context),
				llmUsed: false,
				fallbackUsed: true
			};
		}

		try {
			// Attempt LLM synthesis
			const fullPrompt = `${prompt}\n\nContext:\n${JSON.stringify(context, null, 2)}`;
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

			// Try next provider or fallback
			return this.synthesize(context, prompt);
		}
	}

	/**
	 * Generate response with automatic fallback
	 */
	async generateWithFallback(
		query: string,
		context?: Record<string, unknown>
	): Promise<PipelineResult['metadata']> {
		const startTime = Date.now();
		let llmUsed = false;
		let fallbackUsed = false;
		let circuitBreakerOpen = false;

		try {
			const prompt = `Based on the following query, provide a comprehensive response:\n\nQuery: ${query}`;
			
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
			// Complete failure - all providers and fallback failed
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
	getCircuitBreakerStates(): Map<string, CircuitBreakerState> {
		return this.circuitBreaker.getAllStates();
	}

	/**
	 * Reset circuit breaker for a specific provider
	 */
	resetCircuitBreaker(providerId: string): void {
		const current = this.circuitBreaker.getState(providerId);
		this.circuitBreaker.recordSuccess(providerId);
		
		// Force reset to closed state
		const updated: CircuitBreakerState = {
			...current,
			state: 'closed',
			failures: 0,
			nextRetryTime: undefined
		};
		
		// Update internal state map directly
		const states = this.circuitBreaker.getAllStates();
		states.set(providerId, updated);
	}

	/**
	 * Check if any LLM providers are available
	 */
	hasAvailableProviders(): boolean {
		return this.getAvailableProvider() !== null;
	}
}

/**
 * Create a simple LLM provider wrapper for external APIs
 */
export function createLLMProvider(
	id: string,
	name: string,
	apiEndpoint: string,
	apiKeyEnvVar: string,
	options?: { model?: string; maxTokens?: number }
): LLMProvider {
	return {
		id,
		name,
		model: options?.model,
		maxTokens: options?.maxTokens,
		generate: async (prompt: string): Promise<string> => {
			const apiKey = process.env[apiKeyEnvVar];
			
			if (!apiKey) {
				throw new Error(`API key not found for provider ${id}. Set ${apiKeyEnvVar} environment variable.`);
			}

			const response = await fetch(apiEndpoint, {
				method: 'POST',
				headers: {
					'Content-Type': 'application/json',
					'Authorization': `Bearer ${apiKey}`
				},
				body: JSON.stringify({
					model: options?.model || 'default',
					messages: [{ role: 'user', content: prompt }],
					max_tokens: options?.maxTokens || 1000
				})
			});

			if (!response.ok) {
				throw new Error(`LLM API request failed: ${response.status} ${response.statusText}`);
			}

			const data = await response.json();
			return data.choices?.[0]?.message?.content || '';
		}
	};
}

/**
 * Singleton instance for global synthesizer
 */
let globalSynthesizer: Synthesizer | null = null;

export function getGlobalSynthesizer(config?: Partial<SynthesizerConfig>): Synthesizer {
	if (!globalSynthesizer) {
		globalSynthesizer = new Synthesizer(config);
	}
	return globalSynthesizer;
}

export function destroyGlobalSynthesizer(): void {
	globalSynthesizer = null;
}
