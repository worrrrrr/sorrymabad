import { json } from '@sveltejs/kit';
import type { RequestHandler } from './$types';

// In-memory cache for pipeline results (in production, use a proper database)
const pipelineCache = new Map<string, any>();

/**
 * GET /api/pipeline/[id]
 * Retrieve pipeline results by ID
 */
export const GET: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json(
			{ error: 'Pipeline ID is required' },
			{ status: 400 }
		);
	}

	// Try to get from cache
	const cached = pipelineCache.get(id);
	if (cached) {
		return json(cached, { status: 200 });
	}

	// In production, you would fetch from a database
	// For now, return not found
	return json(
		{ error: 'Pipeline results not found' },
		{ status: 404 }
	);
};

/**
 * POST /api/pipeline
 * Store pipeline results in cache
 */
export const POST: RequestHandler = async ({ request }) => {
	try {
		const body = await request.json();
		const { pipelineId, result } = body;

		if (!pipelineId || !result) {
			return json(
				{ error: 'pipelineId and result are required' },
				{ status: 400 }
			);
		}

		// Store in cache with TTL (in production, use Redis or similar)
		pipelineCache.set(pipelineId, {
			...result,
			cachedAt: Date.now()
		});

		// Auto-expire after 1 hour (in production, use proper TTL)
		setTimeout(() => {
			pipelineCache.delete(pipelineId);
		}, 60 * 60 * 1000);

		return json(
			{ success: true, pipelineId },
			{ status: 201 }
		);
	} catch (error) {
		console.error('Failed to store pipeline result:', error);
		return json(
			{ error: 'Failed to store pipeline result' },
			{ status: 500 }
		);
	}
};

/**
 * DELETE /api/pipeline/[id]
 * Remove pipeline results from cache
 */
export const DELETE: RequestHandler = async ({ params }) => {
	const { id } = params;

	if (!id) {
		return json(
			{ error: 'Pipeline ID is required' },
			{ status: 400 }
		);
	}

	pipelineCache.delete(id);

	return json(
		{ success: true },
		{ status: 200 }
	);
};
