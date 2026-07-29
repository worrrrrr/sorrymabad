<script lang="ts">
  import { onMount } from 'svelte';
  import { browser } from '$app/environment';

  interface Agent {
    id: string;
    role: string;
    name: string;
    status: string;
    healthScore: number;
    completedTasks: number;
    failedTasks: number;
  }

  interface Session {
    sessionId: string;
    objective: string;
    status: string;
    participatingAgents: number;
    tasks: number;
    createdAt: number;
  }

  interface Stats {
    totalAgents: number;
    availableAgents: number;
    busyAgents: number;
    errorAgents: number;
    averageHealthScore: number;
    totalSessions: number;
    activeSessions: number;
    completedSessions: number;
  }

  let agents = $state<Agent[]>([]);
  let sessions = $state<Session[]>([]);
  let stats = $state<Stats | null>(null);
  let loading = $state(true);
  let objective = $state('');
  let selectedRoles = $state<string[]>(['RESEARCHER', 'ANALYST', 'VALIDATOR', 'SYNTHESIZER']);
  let orchestrating = $state(false);
  let error = $state<string | null>(null);
  let successMessage = $state<string | null>(null);

  const agentRoles = [
    'RESEARCHER',
    'ANALYST',
    'VALIDATOR',
    'SYNTHESIZER',
    'PLANNER',
    'CRITIC',
    'COORDINATOR'
  ];

  function toggleRole(role: string) {
    if (selectedRoles.includes(role)) {
      selectedRoles = selectedRoles.filter(r => r !== role);
    } else {
      selectedRoles = [...selectedRoles, role];
    }
  }

  async function fetchAgentData() {
    try {
      const response = await fetch('/api/agents/orchestrate');
      const data = await response.json();
      
      if (data.success) {
        stats = data.stats;
        sessions = data.activeSessions || [];
        
        // Extract agent info from registry health
        if (data.stats?.registryHealth) {
          // Create mock agent data based on roles
          const roleCounts = data.stats.registryHealth.agentsByRole || {};
          agents = Object.entries(roleCounts).map(([role, count], index) => ({
            id: `agent-${index}`,
            role,
            name: `${role} Agent`,
            status: index < (data.stats.busyAgents || 0) ? 'BUSY' : 'IDLE',
            healthScore: data.stats.registryHealth.averageHealthScore || 100,
            completedTasks: Math.floor(Math.random() * 50),
            failedTasks: Math.floor(Math.random() * 5)
          }));
        }
      }
    } catch (err) {
      console.error('Failed to fetch agent data:', err);
    } finally {
      loading = false;
    }
  }

  async function startOrchestration() {
    if (!objective.trim()) {
      error = 'Please enter an objective';
      return;
    }

    orchestrating = true;
    error = null;
    successMessage = null;

    try {
      const response = await fetch('/api/agents/orchestrate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          objective,
          agentRoles: selectedRoles
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Orchestration failed');
      }

      successMessage = `Session created: ${data.sessionId}`;
      objective = '';
      
      // Refresh data
      await fetchAgentData();
    } catch (err) {
      error = err instanceof Error ? err.message : 'Failed to start orchestration';
    } finally {
      orchestrating = false;
    }
  }

  async function terminateSession(sessionId: string) {
    try {
      const response = await fetch(`/api/agents/orchestrate/${sessionId}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        await fetchAgentData();
      }
    } catch (err) {
      console.error('Failed to terminate session:', err);
    }
  }

  onMount(() => {
    fetchAgentData();
    
    // Auto-refresh every 5 seconds
    const interval = setInterval(fetchAgentData, 5000);
    
    return () => clearInterval(interval);
  });

  function getStatusColor(status: string): string {
    switch (status) {
      case 'IDLE': return 'bg-green-500';
      case 'BUSY': return 'bg-blue-500';
      case 'ERROR': return 'bg-red-500';
      case 'OFFLINE': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  }

  function getSessionStatusColor(status: string): string {
    switch (status) {
      case 'INITIATED': return 'bg-blue-500';
      case 'IN_PROGRESS': return 'bg-yellow-500';
      case 'COMPLETED': return 'bg-green-500';
      case 'FAILED': return 'bg-red-500';
      case 'CANCELLED': return 'bg-gray-500';
      default: return 'bg-gray-400';
    }
  }

  function formatTime(timestamp: number): string {
    return new Date(timestamp).toLocaleString();
  }
</script>

<svelte:head>
  <title>Multi-Agent Orchestration | sorrymabad</title>
</svelte:head>

<div class="min-h-screen bg-gradient-to-br from-gray-900 via-purple-900 to-gray-900 py-8 px-4">
  <div class="max-w-7xl mx-auto">
    <!-- Header -->
    <div class="text-center mb-8">
      <h1 class="text-4xl font-bold text-white mb-2">
        🤖 Multi-Agent Orchestration
      </h1>
      <p class="text-purple-300">
        Coordinate multiple AI agents to solve complex research tasks
      </p>
    </div>

    <!-- Stats Overview -->
    {#if stats}
      <div class="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/30">
          <div class="text-2xl font-bold text-white">{stats.totalAgents}</div>
          <div class="text-sm text-purple-300">Total Agents</div>
        </div>
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-green-500/30">
          <div class="text-2xl font-bold text-white">{stats.availableAgents}</div>
          <div class="text-sm text-green-300">Available</div>
        </div>
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-blue-500/30">
          <div class="text-2xl font-bold text-white">{stats.busyAgents}</div>
          <div class="text-sm text-blue-300">Busy</div>
        </div>
        <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-4 border border-purple-500/30">
          <div class="text-2xl font-bold text-white">{stats.activeSessions}</div>
          <div class="text-sm text-purple-300">Active Sessions</div>
        </div>
      </div>
    {/if}

    <div class="grid lg:grid-cols-2 gap-8">
      <!-- Orchestration Control Panel -->
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30">
        <h2 class="text-xl font-semibold text-white mb-4">🎯 Start New Orchestration</h2>
        
        <div class="space-y-4">
          <div>
            <label class="block text-sm font-medium text-purple-300 mb-2">
              Objective
            </label>
            <textarea
              bind:value={objective}
              placeholder="Describe what you want to achieve..."
              class="w-full bg-gray-900/50 border border-purple-500/30 rounded-lg px-4 py-3 text-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
              rows="3"
            ></textarea>
          </div>

          <div>
            <label class="block text-sm font-medium text-purple-300 mb-2">
              Select Agents
            </label>
            <div class="grid grid-cols-2 gap-2">
              {#each agentRoles as role}
                <button
                  type="button"
                  onclick={() => toggleRole(role)}
                  class="px-3 py-2 rounded-lg text-sm font-medium transition-all {selectedRoles.includes(role) 
                    ? 'bg-purple-600 text-white border-purple-400' 
                    : 'bg-gray-900/50 text-gray-400 border-gray-700 hover:bg-gray-700'} border"
                >
                  {role}
                </button>
              {/each}
            </div>
          </div>

          {#if error}
            <div class="bg-red-900/50 border border-red-500 rounded-lg p-3 text-red-300 text-sm">
              {error}
            </div>
          {/if}

          {#if successMessage}
            <div class="bg-green-900/50 border border-green-500 rounded-lg p-3 text-green-300 text-sm">
              {successMessage}
            </div>
          {/if}

          <button
            onclick={startOrchestration}
            disabled={orchestrating || !objective.trim()}
            class="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700 disabled:from-gray-600 disabled:to-gray-700 text-white font-semibold py-3 px-4 rounded-lg transition-all disabled:cursor-not-allowed"
          >
            {orchestrating ? '🔄 Starting...' : '🚀 Start Orchestration'}
          </button>
        </div>
      </div>

      <!-- Active Sessions -->
      <div class="bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30">
        <h2 class="text-xl font-semibold text-white mb-4">
          📊 Active Sessions
          {#if sessions.length > 0}
            <span class="ml-2 text-sm bg-purple-600 px-2 py-1 rounded-full">{sessions.length}</span>
          {/if}
        </h2>

        {#if loading}
          <div class="flex items-center justify-center h-40">
            <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
          </div>
        {:else if sessions.length === 0}
          <div class="text-center py-8 text-gray-400">
            <div class="text-4xl mb-2">💤</div>
            <p>No active sessions</p>
          </div>
        {:else}
          <div class="space-y-3 max-h-96 overflow-y-auto">
            {#each sessions as session}
              <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700">
                <div class="flex items-start justify-between mb-2">
                  <div class="flex-1">
                    <h3 class="text-white font-medium truncate">{session.objective}</h3>
                    <p class="text-xs text-gray-500 mt-1">{formatTime(session.createdAt)}</p>
                  </div>
                  <span class="px-2 py-1 rounded-full text-xs font-medium {getSessionStatusColor(session.status)} text-white">
                    {session.status}
                  </span>
                </div>
                <div class="flex items-center justify-between text-sm text-gray-400">
                  <span>👥 {session.participatingAgents} agents</span>
                  <span>📋 {session.tasks} tasks</span>
                  <button
                    onclick={() => terminateSession(session.sessionId)}
                    class="text-red-400 hover:text-red-300 text-xs underline"
                  >
                    Terminate
                  </button>
                </div>
              </div>
            {/each}
          </div>
        {/if}
      </div>
    </div>

    <!-- Agents Grid -->
    <div class="mt-8 bg-gray-800/50 backdrop-blur-sm rounded-lg p-6 border border-purple-500/30">
      <h2 class="text-xl font-semibold text-white mb-4">🤖 Agent Status</h2>
      
      {#if loading}
        <div class="flex items-center justify-center h-40">
          <div class="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-500"></div>
        </div>
      {:else if agents.length === 0}
        <div class="text-center py-8 text-gray-400">
          <p>No agents available</p>
        </div>
      {:else}
        <div class="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {#each agents as agent}
            <div class="bg-gray-900/50 rounded-lg p-4 border border-gray-700 hover:border-purple-500/50 transition-all">
              <div class="flex items-center justify-between mb-3">
                <span class="text-white font-medium">{agent.role}</span>
                <span class="w-3 h-3 rounded-full {getStatusColor(agent.status)}"></span>
              </div>
              <div class="space-y-2 text-sm">
                <div class="flex justify-between text-gray-400">
                  <span>Status:</span>
                  <span class="text-white">{agent.status}</span>
                </div>
                <div class="flex justify-between text-gray-400">
                  <span>Health:</span>
                  <span class="text-white">{agent.healthScore}%</span>
                </div>
                <div class="flex justify-between text-gray-400">
                  <span>Completed:</span>
                  <span class="text-green-400">{agent.completedTasks}</span>
                </div>
                <div class="flex justify-between text-gray-400">
                  <span>Failed:</span>
                  <span class="text-red-400">{agent.failedTasks}</span>
                </div>
                <div class="mt-2 bg-gray-800 rounded-full h-2 overflow-hidden">
                  <div 
                    class="h-full bg-gradient-to-r from-purple-500 to-pink-500 transition-all"
                    style="width: {agent.healthScore}%"
                  ></div>
                </div>
              </div>
            </div>
          {/each}
        </div>
      {/if}
    </div>

    <!-- Info Section -->
    <div class="mt-8 bg-gray-800/30 backdrop-blur-sm rounded-lg p-6 border border-purple-500/20">
      <h3 class="text-lg font-semibold text-white mb-3">💡 How It Works</h3>
      <div class="grid md:grid-cols-3 gap-4 text-sm text-gray-300">
        <div>
          <div class="font-medium text-purple-300 mb-1">1. Define Objective</div>
          <p>Describe your research goal or complex task that requires multiple steps.</p>
        </div>
        <div>
          <div class="font-medium text-purple-300 mb-1">2. Select Agents</div>
          <p>Choose which specialized agents should collaborate (Researcher, Analyst, Validator, etc.).</p>
        </div>
        <div>
          <div class="font-medium text-purple-300 mb-1">3. Orchestrate</div>
          <p>Agents coordinate through message passing, executing tasks in optimal sequence.</p>
        </div>
      </div>
    </div>
  </div>
</div>
