import { h as head, d as attr, e as escape_html, c as ensure_array_like } from "../../chunks/index2.js";
import "@sveltejs/kit/internal";
import "../../chunks/exports.js";
import "../../chunks/utils.js";
import "@sveltejs/kit/internal/server";
import "../../chunks/root.js";
import "../../chunks/state.svelte.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let query = "";
    let isLoading = false;
    let history = [];
    head("1uha8ag", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>SorryMyBad - Research System</title>`);
      });
    });
    $$renderer2.push(`<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"><div class="container mx-auto px-4 py-12"><header class="text-center mb-12"><h1 class="text-5xl font-bold text-white mb-4"><span class="bg-gradient-to-r from-purple-400 to-pink-400 bg-clip-text text-transparent">SorryMyBad</span></h1> <p class="text-slate-300 text-lg max-w-2xl mx-auto">Deterministic-first personal research system. LLM is only a Router + Synthesizer.
				Deterministic tools are the source of truth.</p></header> <main class="max-w-4xl mx-auto"><div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 shadow-2xl border border-slate-700"><form><div class="relative"><textarea placeholder="What do you want to research today?" class="w-full bg-slate-900/50 text-white placeholder-slate-400 rounded-xl p-6 pr-32 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all duration-200 resize-none min-h-[120px] text-lg"${attr("rows", 3)}${attr("disabled", isLoading, true)}>`);
    const $$body = escape_html(query);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea> <button type="submit"${attr("disabled", !query.trim(), true)} class="absolute bottom-4 right-4 bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-6 py-3 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<span>Research</span> <svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 10V3L4 14h7v7l9-11h-7z"></path></svg>`);
    }
    $$renderer2.push(`<!--]--></button></div></form> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    if (history.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="mt-12"><div class="flex items-center justify-between mb-6"><h2 class="text-2xl font-bold text-white">Recent Research</h2> <button class="text-slate-400 hover:text-red-400 transition-colors text-sm">Clear History</button></div> <div class="space-y-3"><!--[-->`);
      const each_array = ensure_array_like(history);
      for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
        let entry = each_array[$$index];
        $$renderer2.push(`<button class="w-full bg-slate-800/30 hover:bg-slate-800/50 border border-slate-700 hover:border-purple-500/50 rounded-xl p-4 text-left transition-all duration-200 group"><div class="flex items-center justify-between"><div class="flex-1"><p class="text-white font-medium group-hover:text-purple-300 transition-colors">${escape_html(entry.query)}</p> <p class="text-slate-400 text-sm mt-1">${escape_html(new Date(entry.timestamp).toLocaleString())}</p></div> <svg class="w-5 h-5 text-slate-500 group-hover:text-purple-400 transition-colors" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 5l7 7-7 7"></path></svg></div></button>`);
      }
      $$renderer2.push(`<!--]--></div></div>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></main> <footer class="mt-20 text-center text-slate-400 text-sm"><p>Built with SvelteKit + Cloudflare • Deterministic-First Architecture</p></footer></div></div>`);
  });
}
export {
  _page as default
};
