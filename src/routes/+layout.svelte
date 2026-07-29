<script lang="ts">
	import { page } from '$app/stores';
</script>

<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900">
	<!-- Navigation Bar -->
	<nav class="border-b border-slate-700/50 backdrop-blur-sm bg-slate-900/30 sticky top-0 z-50">
		<div class="container mx-auto px-4">
			<div class="flex items-center justify-between h-16">
				<!-- Logo -->
				<a href="/" class="flex items-center gap-2 group">
					<span class="text-2xl font-bold bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">
						SorryMyBad
					</span>
				</a>

				<!-- Navigation Links -->
				<div class="hidden md:flex items-center gap-8">
					<a 
						href="/" 
						class="text-slate-300 hover:text-white transition-colors ${page.url.pathname === '/' ? 'text-purple-400' : ''}"
					>
						Research
					</a>
					<a 
						href="/dashboard" 
						class="text-slate-300 hover:text-white transition-colors ${page.url.pathname === '/dashboard' ? 'text-purple-400' : ''}"
					>
						Dashboard
					</a>
					<a 
						href="/config" 
						class="text-slate-300 hover:text-white transition-colors ${page.url.pathname === '/config' ? 'text-purple-400' : ''}"
					>
						Config
					</a>
				</div>

				<!-- Mobile Menu Button (simplified) -->
				<div class="md:hidden">
					<button class="text-slate-300 hover:text-white">
						<svg class="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
							<path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 6h16M4 12h16M4 18h16"/>
						</svg>
					</button>
				</div>
			</div>
		</div>
	</nav>

	<!-- Main Content -->
	<main>
		<slot />
	</main>

	<!-- Footer -->
	<footer class="border-t border-slate-700/50 mt-20 py-8">
		<div class="container mx-auto px-4 text-center text-slate-400 text-sm">
			<p>SorryMyBad © {new Date().getFullYear()} • Deterministic-First Research System</p>
			<p class="mt-2">Built with SvelteKit + Cloudflare Workers</p>
		</div>
	</footer>
</div>
