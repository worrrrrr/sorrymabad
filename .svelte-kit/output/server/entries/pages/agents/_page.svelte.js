import { h as head, e as escape_html, c as ensure_array_like, a as attr_class, d as attr } from "../../../chunks/index2.js";
function _page($$renderer, $$props) {
  $$renderer.component(($$renderer2) => {
    let sessions = [];
    let objective = "";
    let selectedRoles = ["RESEARCHER", "ANALYST", "VALIDATOR", "SYNTHESIZER"];
    const agentRoles = [
      "RESEARCHER",
      "ANALYST",
      "VALIDATOR",
      "SYNTHESIZER",
      "PLANNER",
      "CRITIC",
      "COORDINATOR"
    ];
    head("h3sa6j", $$renderer2, ($$renderer3) => {
      $$renderer3.title(($$renderer4) => {
        $$renderer4.push(`<title>Multi-Agent Orchestration | sorrymabad</title>`);
      });
    });
    $$renderer2.push(`<div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 py-8 px-4"><div class="max-w-7xl mx-auto"><div class="text-center mb-8"><h1 class="text-4xl font-bold text-white mb-2">🤖 Multi-Agent Orchestration</h1> <p class="text-purple-300">Coordinate multiple AI agents to solve complex research tasks</p></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <div class="grid lg:grid-cols-2 gap-8"><div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30"><h2 class="text-xl font-semibold text-white mb-4">🎯 Start New Orchestration</h2> <div class="space-y-4"><div><label class="block text-sm font-medium text-purple-300 mb-2">Objective</label> <textarea placeholder="Describe what you want to achieve..." class="w-full bg-gray-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500" rows="3">`);
    const $$body = escape_html(objective);
    if ($$body) {
      $$renderer2.push(`${$$body}`);
    }
    $$renderer2.push(`</textarea></div> <div><label class="block text-sm font-medium text-purple-300 mb-2">Select Agents</label> <div class="grid grid-cols-2 gap-2"><!--[-->`);
    const each_array = ensure_array_like(agentRoles);
    for (let $$index = 0, $$length = each_array.length; $$index < $$length; $$index++) {
      let role = each_array[$$index];
      $$renderer2.push(`<button type="button"${attr_class(`px-3 py-2 rounded-lg text-sm font-medium transition-all ${selectedRoles.includes(role) ? "bg-purple-600 text-white border-purple-400" : "bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-700"} border`)}>${escape_html(role)}</button>`);
    }
    $$renderer2.push(`<!--]--></div></div> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> `);
    {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--> <button${attr("disabled", !objective.trim(), true)} class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed">${escape_html("🚀 Start Orchestration")}</button></div></div> <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30"><h2 class="text-xl font-semibold text-white mb-4">📊 Active Sessions `);
    if (sessions.length > 0) {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<span class="ml-2 text-sm bg-purple-600 px-2 py-1 rounded-full">${escape_html(sessions.length)}</span>`);
    } else {
      $$renderer2.push("<!--[-1-->");
    }
    $$renderer2.push(`<!--]--></h2> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center justify-center h-40"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>`);
    }
    $$renderer2.push(`<!--]--></div></div> <div class="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30"><h2 class="text-xl font-semibold text-white mb-4">🤖 Agent Status</h2> `);
    {
      $$renderer2.push("<!--[0-->");
      $$renderer2.push(`<div class="flex items-center justify-center h-40"><div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div></div>`);
    }
    $$renderer2.push(`<!--]--></div> <div class="mt-8 bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20"><h3 class="text-lg font-semibold text-white mb-3">💡 How It Works</h3> <div class="grid md:grid-cols-3 gap-4 text-sm text-gray-300"><div><div class="font-medium text-purple-300 mb-1">1. Define Objective</div> <p>Describe your research goal or complex task that requires multiple steps.</p></div> <div><div class="font-medium text-purple-300 mb-1">2. Select Agents</div> <p>Choose which specialized agents should collaborate (Researcher, Analyst, Validator, etc.).</p></div> <div><div class="font-medium text-purple-300 mb-1">3. Orchestrate</div> <p>Agents coordinate through message passing, executing tasks in optimal sequence.</p></div></div></div></div></div>`);
  });
}
export {
  _page as default
};
