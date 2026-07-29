<script lang="ts">
	import { onMount } from 'svelte';

	let stats = $state<any>(null);
	let isLoading = $state(true);

	onMount(async () => {
		try {
			const response = await fetch('/api/status');
			stats = await response.json();
		} catch (e) {
			console.error('Failed to load status', e);
		} finally {
			isLoading = false;
		}
	});
</script>

<svelte:head>
	<title>Dashboard - SorryMyBad</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
	<div class="container mx-auto px-4 py-12">
		<header class="mb-12">
			<h1 class="text-4xl font-bold text-white mb-2">System Dashboard</h1>
			<p class="text-slate-300">Monitor pipeline health and performance metrics</p>
		</header>

		{#if isLoading}
			<div class="flex items-center justify-center min-h-[40vh]">
				<svg class="animate-spin h-12 w-12 text-purple-400" viewBox="0 0 24 24">
					<circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none"/>
					<path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
				</svg>
			</div>
		{:else if stats}
			<div class="space-y-8">
				<!-- System Status -->
				<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
					<h2 class="text-2xl font-bold text-white mb-6">System Status</h2>
					<div class="flex items-center gap-4 mb-6">
						<div class="w-4 h-4 rounded-full bg-green-400 animate-pulse"></div>
						<span class="text-green-400 font-semibold text-lg">All Systems Operational</span>
					</div>
					
					<div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
						{#each Object.entries(stats.layers) as [layer, status]}
							<div class="bg-slate-900/50 rounded-xl p-4">
								<div class="text-slate-400 text-sm capitalize mb-2">{layer}</div>
								<div class="flex items-center gap-2">
									<div class="w-2 h-2 rounded-full ${
										status === 'operational' ? 'bg-green-400' : 'bg-red-400'
									}"></div>
									<span class="text-white font-medium capitalize">{status}</span>
								</div>
							</div>
						{/each}
					</div>
				</div>

				<!-- Environment Config -->
				<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
					<h2 class="text-2xl font-bold text-white mb-6">Environment Configuration</h2>
					<div class="grid grid-cols-1 md:grid-cols-2 gap-4">
						<div class="bg-slate-900/50 rounded-xl p-4">
							<div class="text-slate-400 text-sm mb-2">LLM Configured</div>
							<div class="flex items-center gap-2">
								{#if stats.environment.llmConfigured}
									<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
									</svg>
									<span class="text-white">Yes</span>
								{:else}
									<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
									</svg>
									<span class="text-yellow-300">No - LLM features will use fallback</span>
								{/if}
							</div>
						</div>
						<div class="bg-slate-900/50 rounded-xl p-4">
							<div class="text-slate-400 text-sm mb-2">Worker Pool Configured</div>
							<div class="flex items-center gap-2">
								{#if stats.environment.workerPoolConfigured}
									<svg class="w-5 h-5 text-green-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 13l4 4L19 7"/>
									</svg>
									<span class="text-white">Yes</span>
								{:else}
									<svg class="w-5 h-5 text-yellow-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
										<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/>
									</svg>
									<span class="text-yellow-300">No - Heavy tasks may be slower</span>
								{/if}
							</div>
						</div>
					</div>
				</div>

				<!-- System Info -->
				<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
					<h2 class="text-2xl font-bold text-white mb-6">System Information</h2>
					<div class="grid grid-cols-1 md:grid-cols-3 gap-4">
						<div class="bg-slate-900/50 rounded-xl p-4">
							<div class="text-slate-400 text-sm mb-2">Version</div>
							<div class="text-white font-mono">{stats.version}</div>
						</div>
						<div class="bg-slate-900/50 rounded-xl p-4">
							<div class="text-slate-400 text-sm mb-2">Status</div>
							<div class="text-green-400 font-semibold capitalize">{stats.status}</div>
						</div>
						<div class="bg-slate-900/50 rounded-xl p-4">
							<div class="text-slate-400 text-sm mb-2">Last Updated</div>
							<div class="text-white font-mono text-sm">
								{new Date(stats.timestamp).toLocaleString()}
							</div>
						</div>
					</div>
				</div>

				<!-- Quick Actions -->
				<div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700">
					<h2 class="text-2xl font-bold text-white mb-6">Quick Actions</h2>
					<div class="flex flex-wrap gap-4">
						<a href="/" class="bg-purple-600 hover:bg-purple-500 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
							New Research
						</a>
						<a href="/config" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors">
							System Configuration
						</a>
						<button 
							onclick={() => window.location.reload()}
							class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-3 rounded-lg transition-colors"
						>
							Refresh Status
						</button>
					</div>
				</div>
			</div>
		{:else}
			<div class="bg-red-900/30 border border-red-700 rounded-2xl p-8 text-center">
				<p class="text-red-300">Failed to load dashboard data</p>
			</div>
		{/if}
	</div>
</div>
