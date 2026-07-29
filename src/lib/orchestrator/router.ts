import type { UserIntent } from '$lib/types/pipeline';

/**
 * Layer 1: Intent Router
 * Fast regex-first matching with LLM fallback structure
 * Philosophy: LLM is ONLY a Router + Synthesizer
 */

export interface RouteMatch {
	category: UserIntent['category'];
	confidence: number;
	parameters?: Record<string, unknown>;
	matchedPattern?: string;
}

export interface RouterConfig {
	llmFallbackEnabled: boolean;
	minConfidenceThreshold: number;
	customPatterns?: Array<{ pattern: RegExp; category: UserIntent['category'] }>;
}

const DEFAULT_PATTERNS: Array<{ pattern: RegExp; category: UserIntent['category'] }> = [
	// Search patterns
	{
		pattern: /\b(search|find|look up|google|query)\b/i,
		category: 'search'
	},
	{
		pattern: /\b(what is|who is|where is|when is|how to)\b/i,
		category: 'search'
	},
	// Calculation patterns
	{
		pattern: /\d+\s*[\+\-\*\/]\s*\d+/,
		category: 'calculation'
	},
	{
		pattern: /\b(calculate|compute|solve|evaluate)\b/i,
		category: 'calculation'
	},
	// Analysis patterns
	{
		pattern: /\b(analyze|compare|contrast|break down|examine)\b/i,
		category: 'analysis'
	},
	// Verification patterns
	{
		pattern: /\b(verify|validate|check|confirm|prove)\b/i,
		category: 'verification'
	},
	// Synthesis patterns
	{
		pattern: /\b(summarize|synthesize|combine|merge|overview)\b/i,
		category: 'synthesis'
	}
];

/**
 * Extract parameters from query based on category
 */
function extractParameters(query: string, category: UserIntent['category']): Record<string, unknown> {
	const params: Record<string, unknown> = {};

	switch (category) {
		case 'calculation': {
			// Extract numbers and operators
			const calcMatch = query.match(/([\d.]+)\s*([\+\-\*\/])\s*([\d.]+)/);
			if (calcMatch) {
				params.numbers = [parseFloat(calcMatch[1]), parseFloat(calcMatch[3])];
				params.operator = calcMatch[2];
			}
			break;
		}
		case 'search': {
			// Extract search terms (simplified)
			const searchTerms = query.replace(/^(search|find|look up|what is|who is|where is|when is|how to)\s+/i, '');
			params.searchTerms = searchTerms.trim();
			break;
		}
		case 'analysis': {
			// Extract subjects to analyze
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

/**
 * Regex-first intent router
 * Returns high-confidence matches without LLM
 */
export function routeIntent(query: string, config: RouterConfig = { llmFallbackEnabled: false, minConfidenceThreshold: 0.7 }): RouteMatch {
	const normalizedQuery = query.trim().toLowerCase();
	
	// Combine default patterns with custom patterns
	const patterns = [...DEFAULT_PATTERNS, ...(config.customPatterns || [])];

	let bestMatch: RouteMatch = {
		category: 'unknown',
		confidence: 0
	};

	for (const { pattern, category } of patterns) {
		const match = pattern.test(normalizedQuery);
		if (match) {
			// Calculate confidence based on pattern specificity
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

	// Apply minimum confidence threshold
	if (bestMatch.confidence < config.minConfidenceThreshold) {
		bestMatch.category = 'unknown';
		bestMatch.confidence = 0.5; // Default for unknown
	}

	return bestMatch;
}

/**
 * Calculate confidence score for a pattern match
 */
function calculateConfidence(pattern: RegExp, query: string): number {
	const match = query.match(pattern);
	if (!match) return 0;

	let confidence = 0.5; // Base confidence

	// Boost confidence for exact phrase matches
	if (match[0].length > 5) {
		confidence += 0.2;
	}

	// Boost confidence for multiple indicator words
	const indicatorCount = (query.match(pattern)?.length || 0);
	if (indicatorCount > 1) {
		confidence += 0.15;
	}

	// Cap at 0.95 (never 1.0 to allow LLM override if needed)
	return Math.min(confidence, 0.95);
}

/**
 * LLM Fallback Router Structure
 * Called when regex confidence is below threshold
 * This is a placeholder for actual LLM integration
 */
export async function llmRouteFallback(
	query: string,
	llmProvider: (prompt: string) => Promise<string>
): Promise<RouteMatch> {
	const prompt = `Analyze this user query and categorize it. Respond with JSON:
{
  "category": "search" | "calculation" | "analysis" | "synthesis" | "verification" | "unknown",
  "confidence": 0.0-1.0,
  "parameters": {}
}

Query: "${query}"`;

	try {
		const response = await llmProvider(prompt);
		const parsed = JSON.parse(response);
		
		return {
			category: parsed.category as UserIntent['category'],
			confidence: parsed.confidence,
			parameters: parsed.parameters
		};
	} catch (error) {
		console.error('LLM routing failed:', error);
		return {
			category: 'unknown',
			confidence: 0.3
		};
	}
}

/**
 * Create a complete UserIntent object from a raw query
 */
export function createIntentFromQuery(
	query: string,
	intentId: string,
	config?: RouterConfig
): UserIntent {
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
