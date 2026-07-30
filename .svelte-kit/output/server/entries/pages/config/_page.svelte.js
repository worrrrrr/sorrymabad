import { h as head, d as attr, a as attr_class } from "../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let config = {
      llmEndpoint: "",
      llmModel: "gpt-3.5-turbo",
      maxRetries: 2,
      timeout: 3e4,
      parallelExecution: true,
      sanitizeInput: true,
      llmFallbackEnabled: true,
      circuitBreakerThreshold: 5,
      circuitBreakerResetTimeout: 6e4
    };
    let isSaving = false;
    head("1gp6n77", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Configuration - SorryMyBad</title>`);
      });
    });
    $$renderer2.push(`<div class="min-h-screen bg-gradient-to-br from-slate-900 via-purple-900 to-slate-900"><div class="container mx-auto px-4 py-12"><header class="mb-12"><h1 class="text-4xl font-bold text-white mb-2">System Configuration</h1> <p class="text-slate-300">Customize pipeline behavior and LLM settings</p></header> <form class="max-w-3xl"><div class="space-y-8"><div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700"><h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3"><span>🤖</span> LLM Configuration</h2> <div class="space-y-6"><div><label class="block text-slate-300 font-medium mb-2">LLM API Endpoint <span class="text-slate-500 text-sm ml-2">(Optional - fallback will be used if empty)</span></label> <input type="url"${attr("value", config.llmEndpoint)} placeholder="https://api.openai.com/v1/chat/completions" class="w-full bg-slate-900/50 text-white placeholder-slate-500 rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"/></div> <div><label class="block text-slate-300 font-medium mb-2">LLM Model</label> `);
    $$renderer2.select(
      {
        value: config.llmModel,
        class: "w-full bg-slate-900/50 text-white rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"
      },
      ($$renderer3) => {
        $$renderer3.option({ value: "gpt-3.5-turbo" }, ($$renderer4) => {
          $$renderer4.push(`GPT-3.5 Turbo`);
        });
        $$renderer3.option({ value: "gpt-4" }, ($$renderer4) => {
          $$renderer4.push(`GPT-4`);
        });
        $$renderer3.option({ value: "gpt-4-turbo" }, ($$renderer4) => {
          $$renderer4.push(`GPT-4 Turbo`);
        });
        $$renderer3.option({ value: "claude-3-haiku" }, ($$renderer4) => {
          $$renderer4.push(`Claude 3 Haiku`);
        });
        $$renderer3.option({ value: "claude-3-sonnet" }, ($$renderer4) => {
          $$renderer4.push(`Claude 3 Sonnet`);
        });
        $$renderer3.option({ value: "claude-3-opus" }, ($$renderer4) => {
          $$renderer4.push(`Claude 3 Opus`);
        });
      }
    );
    $$renderer2.push(`</div> <div class="flex items-center justify-between"><div><label class="text-slate-300 font-medium">LLM Fallback Enabled</label> <p class="text-slate-500 text-sm mt-1">Use LLM when regex routing confidence is low</p></div> <button type="button" role="switch"${attr("aria-checked", config.llmFallbackEnabled)}${attr_class(`relative w-14 h-8 rounded-full transition-colors ${"bg-purple-600"}`)}><span${attr_class(`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${"translate-x-6"}`)}></span></button></div></div></div> <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700"><h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3"><span>⚙️</span> Execution Settings</h2> <div class="space-y-6"><div><label class="block text-slate-300 font-medium mb-2">Max Retries</label> <input type="number" min="0" max="5"${attr("value", config.maxRetries)} class="w-full bg-slate-900/50 text-white rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"/></div> <div><label class="block text-slate-300 font-medium mb-2">Timeout (ms)</label> <input type="number" min="5000" max="120000" step="5000"${attr("value", config.timeout)} class="w-full bg-slate-900/50 text-white rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"/></div> <div class="flex items-center justify-between"><div><label class="text-slate-300 font-medium">Parallel Execution</label> <p class="text-slate-500 text-sm mt-1">Execute independent steps concurrently</p></div> <button type="button" role="switch"${attr("aria-checked", config.parallelExecution)}${attr_class(`relative w-14 h-8 rounded-full transition-colors ${"bg-purple-600"}`)}><span${attr_class(`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${"translate-x-6"}`)}></span></button></div> <div class="flex items-center justify-between"><div><label class="text-slate-300 font-medium">Sanitize Input</label> <p class="text-slate-500 text-sm mt-1">Clean external data to prevent prompt injection</p></div> <button type="button" role="switch"${attr("aria-checked", config.sanitizeInput)}${attr_class(`relative w-14 h-8 rounded-full transition-colors ${"bg-purple-600"}`)}><span${attr_class(`absolute top-1 left-1 w-6 h-6 bg-white rounded-full transition-transform ${"translate-x-6"}`)}></span></button></div></div></div> <div class="bg-slate-800/50 backdrop-blur-sm rounded-2xl p-8 border border-slate-700"><h2 class="text-2xl font-bold text-white mb-6 flex items-center gap-3"><span>🔌</span> Circuit Breaker</h2> <div class="space-y-6"><div><label class="block text-slate-300 font-medium mb-2">Failure Threshold</label> <p class="text-slate-500 text-sm mb-3">Number of failures before opening circuit</p> <input type="number" min="1" max="20"${attr("value", config.circuitBreakerThreshold)} class="w-full bg-slate-900/50 text-white rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"/></div> <div><label class="block text-slate-300 font-medium mb-2">Reset Timeout (ms)</label> <p class="text-slate-500 text-sm mb-3">Time to wait before attempting retry</p> <input type="number" min="10000" max="300000" step="10000"${attr("value", config.circuitBreakerResetTimeout)} class="w-full bg-slate-900/50 text-white rounded-lg p-4 border border-slate-600 focus:border-purple-500 focus:ring-2 focus:ring-purple-500/20 transition-all"/></div></div></div> <div class="flex items-center gap-4"><button type="submit"${attr("disabled", isSaving, true)} class="bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-500 hover:to-pink-500 text-white font-semibold px-8 py-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2">`);
    {
      $$renderer2.push("<!--[-1-->");
      $$renderer2.push(`<svg class="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"></path></svg> <span>Save Configuration</span>`);
    }
    $$renderer2.push(`<!--]--></button> <button type="button" class="bg-slate-700 hover:bg-slate-600 text-white font-semibold px-6 py-4 rounded-lg transition-colors">Reset to Defaults</button> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></div></div></form> <div class="mt-12 max-w-3xl bg-blue-900/30 border border-blue-700 rounded-2xl p-6"><div class="flex items-start gap-4"><svg class="w-6 h-6 text-blue-400 flex-shrink-0 mt-1" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"></path></svg> <div><h3 class="text-blue-300 font-semibold mb-2">Environment Variables</h3> <p class="text-blue-200 text-sm mb-4">For production deployments, set these environment variables instead of using the UI:</p> <code class="block bg-slate-900/50 rounded-lg p-4 text-blue-100 text-sm font-mono overflow-x-auto">LLM_API_ENDPOINT=https://api.openai.com/v1/chat/completions<br/> LLM_API_KEY=your-api-key-here<br/> LLM_MODEL=gpt-3.5-turbo<br/> WORKER_SCRIPT_PATH=./workers/heavy-task.js</code></div></div></div></div></div>`);
  });
}
export {
  _page as default
};
