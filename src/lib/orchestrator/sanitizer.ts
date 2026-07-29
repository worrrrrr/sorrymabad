import type { SanitizedData } from '$lib/types/pipeline';

/**
 * Layer 4: Input Sanitizer
 * Prevents Indirect Prompt Injection from external search data
 */

export interface SanitizationConfig {
	maxLength: number;
	allowedTags: string[];
	blockPatterns: RegExp[];
	stripScripts: boolean;
	normalizeWhitespace: boolean;
}

const DEFAULT_CONFIG: SanitizationConfig = {
	maxLength: 50000,
	allowedTags: ['b', 'i', 'u', 'strong', 'em', 'p', 'br', 'ul', 'ol', 'li', 'a', 'code', 'pre'],
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

/**
 * Detect potential prompt injection attempts
 */
export function detectInjectionAttempts(content: string, config: SanitizationConfig = DEFAULT_CONFIG): string[] {
	const attempts: string[] = [];
	
	for (const pattern of config.blockPatterns) {
		const matches = content.match(pattern);
		if (matches) {
			attempts.push(...matches.map((m) => m.trim()));
		}
	}
	
	return [...new Set(attempts)]; // Remove duplicates
}

/**
 * Calculate trust score based on content analysis
 */
export function calculateTrustScore(
	content: string,
	injectionAttempts: string[],
	sourceType: string
): number {
	let score = 1.0;
	
	// Reduce score for each injection attempt
	score -= injectionAttempts.length * 0.2;
	
	// Reduce score for suspicious source types
	const lowTrustSources = ['user_comment', 'forum', 'social_media', 'wiki'];
	if (lowTrustSources.includes(sourceType)) {
		score -= 0.1;
	}
	
	// Reduce score for very long content (harder to verify)
	if (content.length > 10000) {
		score -= 0.1;
	}
	
	// Reduce score for high entropy content (potential encoded payloads)
	const entropy = calculateEntropy(content);
	if (entropy > 6.0) {
		score -= 0.15;
	}
	
	return Math.max(0, Math.min(1, score));
}

/**
 * Simple entropy calculation for text
 */
function calculateEntropy(text: string): number {
	if (text.length === 0) return 0;
	
	const freq: Record<string, number> = {};
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

/**
 * Strip potentially dangerous HTML/script content
 */
function stripDangerousContent(content: string, config: SanitizationConfig): string {
	let sanitized = content;
	
	// Truncate if too long
	if (sanitized.length > config.maxLength) {
		sanitized = sanitized.substring(0, config.maxLength) + '...[truncated]';
	}
	
	// Strip script tags if enabled
	if (config.stripScripts) {
		sanitized = sanitized.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
		sanitized = sanitized.replace(/<script[^>]*>/gi, '');
		sanitized = sanitized.replace(/<\/script>/gi, '');
	}
	
	// Strip event handlers
	sanitized = sanitized.replace(/\s+on\w+\s*=\s*["'][^"']*["']/gi, '');
	sanitized = sanitized.replace(/\s+on\w+\s*=\s*[^\s>]*/gi, '');
	
	// Strip javascript: URLs
	sanitized = sanitized.replace(/javascript:/gi, 'blocked:');
	
	// Normalize whitespace if enabled
	if (config.normalizeWhitespace) {
		sanitized = sanitized.replace(/\s+/g, ' ').trim();
	}
	
	return sanitized;
}

/**
 * Main sanitization function
 * Returns sanitized content with metadata about injection attempts
 */
export async function sanitizeInput(
	rawContent: string,
	sourceType: string = 'unknown',
	config?: SanitizationConfig
): Promise<SanitizedData> {
	const finalConfig = { ...DEFAULT_CONFIG, ...config };
	
	// Detect injection attempts
	const injectionAttempts = detectInjectionAttempts(rawContent, finalConfig);
	
	// Strip dangerous content
	const sanitizedContent = stripDangerousContent(rawContent, finalConfig);
	
	// Calculate trust score
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

/**
 * Sanitize multiple inputs in parallel
 */
export async function sanitizeMultipleInputs(
	inputs: Array<{ content: string; sourceType: string }>,
	config?: SanitizationConfig
): Promise<SanitizedData[]> {
	return Promise.all(
		inputs.map(({ content, sourceType }) => sanitizeInput(content, sourceType, config))
	);
}

/**
 * Validate if content is safe to use without sanitization
 */
export function isContentSafe(
	content: string,
	config: SanitizationConfig = DEFAULT_CONFIG
): boolean {
	const attempts = detectInjectionAttempts(content, config);
	return attempts.length === 0 && content.length <= config.maxLength;
}

/**
 * Create a sanitization middleware for pipeline steps
 */
export function createSanitizationMiddleware(config?: SanitizationConfig) {
	return async (input: unknown, sourceType: string = 'pipeline_input'): Promise<SanitizedData> => {
		const content = typeof input === 'string' ? input : JSON.stringify(input);
		return sanitizeInput(content, sourceType, config);
	};
}
