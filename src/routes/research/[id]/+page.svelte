<script lang="ts">
	import { browser } from '$app/environment';
	import { page } from '$app/stores';

	let result = $state<any>(null);
	let activeTab = $state('overview');
	let isLoading = $state(true);
	let error = $state<string | null>(null);

	// Get pipeline ID from URL params
	const pipelineId = $derived($page.params.id);

	onMount(async () => {
		if (!browser) return;

		try {
			// Try to get from sessionStorage first (passed from previous page)
			const cached = sessionStorage.getItem(`pipeline_${pipelineId}`);
			if (cached) {
				result = JSON.parse(cached);
				return;
			}

			// Fetch from API
			const response = await fetch(`/api/pipeline/${pipelineId}`);
			
			if (!response.ok) {
				throw new Error('Pipeline results not found');
			}

			result = await response.json();
			
			// Cache for navigation
			sessionStorage.setItem(`pipeline_${pipelineId}`, JSON.stringify(result));
		} catch (e) {
			error = e instanceof Error ? e.message : 'Failed to load results';
		} finally {
			isLoading = false;
		}
	});

	function getStatusColor(status: string) {
		switch (status) {
			case 'success': return 'text-green-400 bg-green-900/30 border-green-700';
			case 'partial': return 'text-yellow-400 bg-yellow-900/30 border-yellow-700';
			case 'failed': return 'text-red-400 bg-red-900/30 border-red-700';
			default: return 'text-slate-400 bg-slate-900/30 border-slate-700';
		}
	}

	function getCategoryIcon(category: string) {
		switch (category) {
			case 'search': return '🔍';
			case 'calculation': return '🧮';
			case 'analysis': return '📊';
			case 'synthesis': return '🧠';
			case 'verification': return '✅';
			default: return '❓';
		}
	}
</script>

<svelte:head>
	<title>Research Results - {pipelineId}</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
	<div class="container mx-auto px-4 py-8">
		{#if isLoading}
			<!-- Loading State -->
			<div class="flex items-center justify-center min-h-[60vh]">
				<div class="text-center">
					<svg class="animate-spin h-16 w-16 text-purple-400 mx-auto mb-4" viewBox="0 0 24 24">
						<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
						<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
					</svg>
					<p class="text-white text-lg">Loading research results...</p>
				</div>
			</div>
		{:else if error}
			<!-- Error State -->
			<div class="max-w-2xl mx-auto mt-20">
				<div class="bg-red-900/30 border border-red-700 rounded-2xl p-8 text-center">
					<svg class="w-16 h-16 text-red-400 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
						<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
					</svg>
					<h2 class="text-2xl font-bold text-red-300 mb-2">Results Not Available</h2>
					<p class="text-red-200 mb-6">{error}</p>
					<a href="/" class="inline-block bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
						Start New Research
					</a>
				</div>
			</div>
		{:else if result}
			<!-- Results Display -->
			<div class="space-y-6">
				<!-- Header with Back Button -->
				<div class="flex items-center gap-4 mb-8">
					<a href="/" class="text-slate-400 hover:text-white transition-colors flex items-center gap-2">
						<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10 19l-7-7m0 0l7-7m-7 7h18"/>
						</svg>
						Back
					</a>
					<div class="flex-1"></div>
					<span class={`px-4 py-2 rounded-full border font-semibold ${getStatusColor(result.status)}`}>
						{result.status.toUpperCase()}
					</span>
				</div>

				<!-- Main Result Card -->
				<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
					<!-- Intent Overview -->
					<div class="mb-8 pb-8 border-b border-slate-700">
						<div class="flex items-start gap-4 mb-4">
							<span class="text-4xl">{getCategoryIcon(result.userIntent.category)}</span>
							<div class="flex-1">
								<h1 class="text-3xl font-bold text-white mb-2">
									{result.userIntent.rawQuery}
								</h1>
								<div class="flex items-center gap-4 text-slate-400">
									<span class="capitalize">{result.userIntent.category}</span>
									<span>•</span>
									<span>Confidence: {(result.userIntent.confidence * 100).toFixed(0)}%</span>
									<span>•</span>
									<span>{new Date(result.metadata.startTime).toLocaleString()}</span>
								</div>
							</div>
						</div>
					</div>

					<!-- Tabs -->
					<div class="flex gap-2 mb-6 border-b border-slate-700">
						<button
							onclick={() => activeTab = 'overview'}
							class={`px-6 py-3 font-medium transition-colors border-b-2 ${
								activeTab === 'overview' 
									? 'text-purple-400 border-purple-400' 
									: 'text-slate-400 border-transparent hover:text-white'
							}`}
						>
							Overview
						</button>
						<button
							onclick={() => activeTab = 'steps'}
							class={`px-6 py-3 font-medium transition-colors border-b-2 ${
								activeTab === 'steps' 
									? 'text-purple-400 border-purple-400' 
									: 'text-slate-400 border-transparent hover:text-white'
							}`}
						>
							Execution Steps ({result.executionGraph.length})
						</button>
						<button
							onclick={() => activeTab = 'results'}
							class={`px-6 py-3 font-medium transition-colors border-b-2 ${
								activeTab === 'results' 
									? 'text-purple-400 border-purple-400' 
									: 'text-slate-400 border-transparent hover:text-white'
							}`}
						>
							Results
						</button>
						{#if result.errors?.length > 0}
							<button
								onclick={() => activeTab = 'errors'}
								class={`px-6 py-3 font-medium transition-colors border-b-2 ${
									activeTab === 'errors' 
										? 'text-red-400 border-red-400' 
										: 'text-slate-400 border-transparent hover:text-white'
								}`}
							>
								Errors ({result.errors.length})
							</button>
						{/if}
					</div>

					<!-- Tab Content -->
					{#if activeTab === 'overview'}
						<div class="space-y-6">
							<!-- Stats Grid -->
							<div class="grid grid-cols-2 md:grid-cols-4 gap-4">
								<div class="bg-slate-900/50 rounded-xl p-4">
									<div class="text-slate-400 text-sm mb-1">Duration</div>
									<div class="text-white text-xl font-bold">{result.metadata.duration}ms</div>
								</div>
								<div class="bg-slate-900/50 rounded-xl p-4">
									<div class="text-slate-400 text-sm mb-1">Steps Executed</div>
									<div class="text-white text-xl font-bold">{result.executionGraph.length}</div>
								</div>
								<div class="bg-slate-900/50 rounded-xl p-4">
									<div class="text-slate-400 text-sm mb-1">LLM Used</div>
									<div class="text-white text-xl font-bold">
										{result.metadata.llmUsed ? '✅ Yes' : '❌ No'}
									</div>
								</div>
								<div class="bg-slate-900/50 rounded-xl p-4">
									<div class="text-slate-400 text-sm mb-1">Fallback Used</div>
									<div class="text-white text-xl font-bold">
										{result.metadata.fallbackUsed ? '✅ Yes' : '❌ No'}
									</div>
								</div>
							</div>

							<!-- Execution Graph Visualization -->
							<div class="bg-slate-900/50 rounded-xl p-6">
								<h3 class="text-lg font-semibold text-white mb-4">Execution Flow</h3>
								<div class="flex flex-wrap items-center gap-2">
									{#each result.executionGraph as step, index (step.stepId)}
										<div class="flex items-center">
											<div class="bg-purple-900/50 border border-purple-700 rounded-lg px-4 py-2 text-white font-medium">
												{step.toolType}
											</div>
											{#if index < result.executionGraph.length - 1}
												<svg class="w-4 h-4 text-slate-500 mx-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
													<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"/>
												</svg>
											{/if}
										</div>
									{/each}
								</div>
							</div>
						</div>
					{/if}

					{#if activeTab === 'steps'}
						<div class="space-y-4">
							{#each result.executionGraph as step (step.stepId)}
								<div class="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
									<div class="flex items-start justify-between mb-4">
										<div>
											<h4 class="text-lg font-semibold text-white mb-1">
												{step.description}
											</h4>
											<div class="flex items-center gap-3 text-sm text-slate-400">
												<span class="bg-slate-800 px-2 py-1 rounded">{step.toolType}</span>
												<span>ID: {step.stepId.slice(0, 8)}...</span>
											</div>
										</div>
										<div class="text-right">
											<div class="text-slate-400 text-sm">Timeout</div>
											<div class="text-white font-mono">{step.timeout / 1000}s</div>
										</div>
									</div>
									
									{#if step.dependencies.length > 0}
										<div class="mt-4 pt-4 border-t border-slate-700">
											<div class="text-slate-400 text-sm mb-2">Dependencies:</div>
											<div class="flex flex-wrap gap-2">
												{#each step.dependencies as dep}
													<span class="bg-slate-800 text-slate-300 px-3 py-1 rounded-full text-sm font-mono">
														{dep.slice(0, 8)}...
													</span>
												{/each}
											</div>
										</div>
									{/if}

									{#if step.inputVariables.length > 0}
										<div class="mt-4 pt-4 border-t border-slate-700">
											<div class="text-slate-400 text-sm mb-2">Input Variables:</div>
											<div class="flex flex-wrap gap-2">
												{#each step.inputVariables as variable}
													<span class="bg-purple-900/50 text-purple-300 px-3 py-1 rounded-full text-sm font-mono">
														{variable}
													</span>
												{/each}
											</div>
										</div>
									{/if}
								</div>
							{/each}
						</div>
					{/if}

					{#if activeTab === 'results'}
						<div class="space-y-6">
							{#each Object.entries(result.results) as [key, value]}
								<div class="bg-slate-900/50 border border-slate-700 rounded-xl p-6">
									<h4 class="text-lg font-semibold text-white mb-4 capitalize">{key}</h4>
									<pre class="bg-slate-950 rounded-lg p-4 overflow-x-auto text-slate-300 text-sm font-mono max-h-96 overflow-y-auto">
{JSON.stringify(value, null, 2)}
									</pre>
								</div>
							{/each}
						</div>
					{/if}

					{#if activeTab === 'errors' && result.errors?.length > 0}
						<div class="space-y-4">
							{#each result.errors as err (err.stepId)}
								<div class={`border rounded-xl p-6 ${
									err.recoverable 
										? 'bg-yellow-900/30 border-yellow-700' 
										: 'bg-red-900/30 border-red-700'
								}`}>
									<div class="flex items-start gap-4">
										<svg class="w-6 h-6 flex-shrink-0 ${
											err.recoverable ? 'text-yellow-400' : 'text-red-400'
										}" fill="none" stroke="currentColor" viewBox="0 0 24 24">
											<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"/>
										</svg>
										<div class="flex-1">
											<div class="flex items-center gap-3 mb-2">
												<span class="font-mono text-white">{err.stepId.slice(0, 8)}...</span>
												<span class={`px-2 py-1 rounded text-xs font-semibold ${
													err.recoverable 
														? 'bg-yellow-900 text-yellow-300' 
														: 'bg-red-900 text-red-300'
												}`}>
													{err.recoverable ? 'RECOVERABLE' : 'CRITICAL'}
												</span>
											</div>
											<p class="text-slate-300">{err.error}</p>
										</div>
									</div>
								</div>
							{/each}
						</div>
					{/if}
				</div>

				<!-- Action Buttons -->
				<div class="flex gap-4 justify-center">
					<a href="/" class="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-8 py-3 rounded-lg transition-colors">
						New Research
					</a>
					<button
						onclick={() => window.print()}
						class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-8 py-3 rounded-lg transition-colors"
					>
						Export PDF
					</button>
				</div>
			</div>
		{/if}
	</div>
</div>

<style>
	pre {
		white-space: pre-wrap;
		word-wrap: break-word;
	}
</style>
