<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import { page } from '$app/stores';

	let query = $state('');
	let isLoading = $state(false);
	let result = $state<any>(null);
	let error = $state<string | null>(null);
	let history = $state<Array<{ id: string; query: string; timestamp: number }>>([]);

	onMount(() => {
		// Load research history from localStorage
		const saved = localStorage.getItem('research_history');
		if (saved) {
			history = JSON.parse(saved);
		}
	});

	async function submitResearch() {
		if (!query.trim()) return;

		isLoading = true;
		error = null;
		result = null;

		try {
			const response = await fetch('/api/research', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					query,
					options: {
						llmFallback: true,
						sanitize: true,
						parallel: true
					}
				})
			});

			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error || 'Research failed');
			}

			result = data;

			// Save to history
			const historyEntry = {
				id: data.pipelineId,
				query,
				timestamp: Date.now()
			};
			history = [historyEntry, ...history.slice(0, 9)];
			localStorage.setItem('research_history', JSON.stringify(history));

			// Navigate to results page
			goto(`/research/${data.pipelineId}`);
		} catch (e) {
			error = e instanceof Error ? e.message : 'An unexpected error occurred';
		} finally {
			isLoading = false;
		}
	}

	function clearHistory() {
		history = [];
		localStorage.removeItem('research_history');
	}

	function loadFromHistory(entry: typeof history[number]) {
		query = entry.query;
	}
</script>

<svelte:head>
	<title>SorryMyBad - Research System</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
	<div class="container mx-auto px-4 py-12">
		<!-- Header -->
		<header class="text-center mb-12">
			<h1 class="text-5xl font-bold text-white mb-4">
				<span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
					SorryMyBad
				</span>
			</h1>
			<p class="text-slate-300 text-lg max-w-2xl mx-auto">
				Deterministic-first personal research system. LLM is only a Router + Synthesizer.
				Deterministic tools are the source of truth.
			</p>
		</header>

		<!-- Main Search Box -->
		<main class="max-w-4xl mx-auto">
			<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700">
				<form onsubmit={(e) => { e.preventDefault(); submitResearch(); }}>
					<div class="relative">
						<textarea
							bind:value={query}
							placeholder="What do you want to research today?"
							class="w-full bg-slate-900/50 text-white placeholder-slate-400 rounded-xl p-6 pr-32 
								   border border-slate-600 focus:border-purple-500 focus:ring-2 
								   focus:ring-purple-500/20 transition-all duration-200 resize-none
								   min-h-[120px] text-lg"
							rows={3}
							disabled={isLoading}
						></textarea>
						
						<button
							type="submit"
							disabled={isLoading || !query.trim()}
							class="absolute bottom-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 
								 hover:from-purple-500 hover:to-pink-500 text-white font-semibold 
								 px-6 py-3 rounded-lg transition-all duration-200 
								 disabled:opacity-50 disabled:cursor-not-allowed
								 flex items-center gap-2"
						>
							{#if isLoading}
								<svg class="animate-spin h-5 w-5" viewBox="0 0 24 24">
									<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
									<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
								</svg>
								<span>Processing...</span>
							{:else}
								<span>Research</span>
								<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
									<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"/>
								</svg>
							{/if}
						</button>
					</div>
				</form>

				<!-- Quick Stats -->
				{#if result}
					<div class="mt-6 grid grid-cols-2 md:grid-cols-4 gap-4">
						<div class="bg-slate-900/50 rounded-lg p-4">
							<div class="text-slate-400 text-sm">Category</div>
							<div class="text-white font-semibold capitalize">{result.userIntent.category}</div>
						</div>
						<div class="bg-slate-900/50 rounded-lg p-4">
							<div class="text-slate-400 text-sm">Confidence</div>
							<div class="text-white font-semibold">{(result.userIntent.confidence * 100).toFixed(0)}%</div>
						</div>
						<div class="bg-slate-900/50 rounded-lg p-4">
							<div class="text-slate-400 text-sm">Steps</div>
							<div class="text-white font-semibold">{result.executionGraph.length}</div>
						</div>
						<div class="bg-slate-900/50 rounded-lg p-4">
							<div class="text-slate-400 text-sm">Duration</div>
							<div class="text-white font-semibold">{result.metadata.duration}ms</div>
						</div>
					</div>
				{/if}
			</div>

			<!-- Error Display -->
			{#if error}
				<div class="mt-6 bg-red-900/30 border border-red-700 rounded-xl p-6">
					<div class="flex items-start gap-4">
						<svg class="w-6 h-6 text-red-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
						</svg>
						<div>
							<h3 class="text-red-300 font-semibold mb-2">Research Failed</h3>
							<p class="text-red-200">{error}</p>
						</div>
					</div>
				</div>
			{/if}

			<!-- Recent History -->
			{#if history.length > 0}
				<div class="mt-12">
					<div class="flex items-center justify-between mb-6">
						<h2 class="text-2xl font-bold text-white">Recent Research</h2>
						<button
							onclick={clearHistory}
							class="text-slate-400 hover:text-red-400 transition-colors text-sm"
						>
							Clear History
						</button>
					</div>
					
					<div class="space-y-3">
						{#each history as entry (entry.id)}
							<button
								onclick={() => loadFromHistory(entry)}
								class="w-full bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700 
									   hover:border-purple-500/50 rounded-xl p-4 text-left 
									   transition-all duration-200 group"
							>
								<div class="flex items-center justify-between">
									<div class="flex-1">
										<p class="text-white font-medium group-hover:text-purple-300 transition-colors">
											{entry.query}
										</p>
										<p class="text-slate-400 text-sm mt-1">
											{new Date(entry.timestamp).toLocaleString()}
										</p>
									</div>
									<svg class="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" 
										 fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
									</svg>
								</div>
							</button>
						{/each}
					</div>
				</div>
			{/if}
		</main>

		<!-- Footer -->
		<footer class="mt-20 text-center text-slate-400 text-sm">
			<p>Built with SvelteKit + Cloudflare • Deterministic-First Architecture</p>
		</footer>
	</div>
</div>

<style>
	:global(body) {
		margin: 0;
		padding: 0;
	}
</style>
