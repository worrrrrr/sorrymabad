import { json } from "@sveltejs/kit";
import { v4 } from "uuid";
class AgentRegistry {
  agents = /* @__PURE__ */ new Map();
  agentsByRole = /* @__PURE__ */ new Map();
  register(agent) {
    if (!agent.config.enabled) {
      throw new Error(`Cannot register disabled agent: ${agent.config.id}`);
    }
    this.agents.set(agent.config.id, agent);
    const role = agent.config.role;
    const roleAgents = this.agentsByRole.get(role) || [];
    roleAgents.push(agent);
    this.agentsByRole.set(role, roleAgents);
    console.log(`[Registry] Registered agent: ${agent.config.name} (${agent.config.role})`);
  }
  unregister(agentId) {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      const roleAgents = this.agentsByRole.get(agent.config.role);
      if (roleAgents) {
        const filtered = roleAgents.filter((a) => a.config.id !== agentId);
        this.agentsByRole.set(agent.config.role, filtered);
      }
      console.log(`[Registry] Unregistered agent: ${agent.config.name}`);
    }
  }
  getAgent(agentId) {
    return this.agents.get(agentId);
  }
  getAgentsByRole(role) {
    return this.agentsByRole.get(role) || [];
  }
  getAllAgents() {
    return Array.from(this.agents.values());
  }
  getAvailableAgents() {
    return this.getAllAgents().filter(
      (agent) => agent.state.status === "IDLE" && agent.config.enabled
    );
  }
  getHealthStatus() {
    const agents = this.getAllAgents();
    return {
      totalAgents: agents.length,
      availableAgents: agents.filter((a) => a.state.status === "IDLE").length,
      busyAgents: agents.filter((a) => a.state.status === "BUSY").length,
      errorAgents: agents.filter((a) => a.state.status === "ERROR").length,
      averageHealthScore: agents.reduce((sum, a) => sum + a.state.healthScore, 0) / agents.length,
      agentsByRole: Object.fromEntries(
        Array.from(this.agentsByRole.entries()).map(([role, agents2]) => [role, agents2.length])
      )
    };
  }
}
class MessageQueue {
  queues = /* @__PURE__ */ new Map();
  MAX_QUEUE_SIZE = 1e3;
  async enqueue(message) {
    const queue = this.queues.get(message.toAgentId) || [];
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      const lowPriorityIndex = queue.findIndex((m) => m.priority === "LOW");
      if (lowPriorityIndex !== -1) {
        queue.splice(lowPriorityIndex, 1);
      } else {
        throw new Error(`Message queue full for agent: ${message.toAgentId}`);
      }
    }
    const priorityOrder = ["CRITICAL", "HIGH", "NORMAL", "LOW"];
    const insertIndex = queue.findIndex(
      (m) => priorityOrder.indexOf(m.priority) < priorityOrder.indexOf(message.priority)
    );
    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }
    this.queues.set(message.toAgentId, queue);
  }
  async dequeue(agentId) {
    const queue = this.queues.get(agentId) || [];
    if (queue.length === 0) {
      return null;
    }
    const message = queue.shift();
    this.queues.set(agentId, queue);
    return message;
  }
  async peek(agentId) {
    const queue = this.queues.get(agentId) || [];
    return queue.length > 0 ? queue[0] : null;
  }
  async getMessageCount(agentId) {
    const queue = this.queues.get(agentId) || [];
    return queue.length;
  }
  clearQueue(agentId) {
    this.queues.set(agentId, []);
  }
  getAllQueuesStats() {
    const stats = {};
    this.queues.forEach((queue, agentId) => {
      stats[agentId] = queue.length;
    });
    return stats;
  }
}
class MultiAgentOrchestrator {
  sessions = /* @__PURE__ */ new Map();
  registry;
  messageQueue;
  SESSION_TIMEOUT_MS = 30 * 60 * 1e3;
  // 30 minutes
  constructor(registry2, messageQueue2) {
    this.registry = registry2;
    this.messageQueue = messageQueue2;
    setInterval(() => this.cleanupStaleSessions(), 60 * 1e3);
  }
  async createSession(objective, agentIds) {
    const sessionId = v4();
    const validAgents = agentIds.filter((id) => {
      const agent = this.registry.getAgent(id);
      if (!agent) {
        console.warn(`[Orchestrator] Agent not found: ${id}`);
        return false;
      }
      return true;
    });
    if (validAgents.length === 0) {
      throw new Error("No valid agents provided for session");
    }
    const session = {
      id: v4(),
      sessionId,
      objective,
      participatingAgents: validAgents,
      messageQueue: [],
      tasks: [],
      status: "INITIATED",
      createdAt: Date.now(),
      errors: []
    };
    this.sessions.set(sessionId, session);
    console.log(`[Orchestrator] Created session: ${sessionId} with ${validAgents.length} agents`);
    return session;
  }
  async assignTask(sessionId, task) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    if (session.status !== "IN_PROGRESS" && session.status !== "INITIATED") {
      throw new Error(`Cannot assign task to session in state: ${session.status}`);
    }
    if (session.status === "INITIATED") {
      session.status = "IN_PROGRESS";
    }
    session.tasks.push(task);
    const agent = this.registry.getAgent(task.assignedTo);
    if (!agent) {
      throw new Error(`Agent not found: ${task.assignedTo}`);
    }
    try {
      const response = await agent.execute(task);
      const taskIndex = session.tasks.findIndex((t) => t.id === task.id);
      if (taskIndex !== -1) {
        session.tasks[taskIndex] = {
          ...session.tasks[taskIndex],
          status: response.success ? "COMPLETED" : "FAILED",
          startedAt: Date.now(),
          completedAt: Date.now(),
          result: response.data,
          error: response.error
        };
      }
      if (!response.success) {
        session.errors.push({
          agentId: task.assignedTo,
          error: response.error || "Unknown error",
          timestamp: Date.now()
        });
      }
    } catch (error) {
      session.errors.push({
        agentId: task.assignedTo,
        error: error instanceof Error ? error.message : "Unknown error",
        timestamp: Date.now()
      });
      const taskIndex = session.tasks.findIndex((t) => t.id === task.id);
      if (taskIndex !== -1) {
        session.tasks[taskIndex] = {
          ...session.tasks[taskIndex],
          status: "FAILED",
          error: error instanceof Error ? error.message : "Unknown error"
        };
      }
    }
  }
  async broadcastMessage(sessionId, message) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.messageQueue.push(message);
    await this.messageQueue.enqueue(message);
    console.log(`[Orchestrator] Broadcast message from ${message.fromAgentId} to ${message.toAgentId}`);
  }
  async getSessionStatus(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    const completedTasks = session.tasks.filter((t) => t.status === "COMPLETED").length;
    const failedTasks = session.tasks.filter((t) => t.status === "FAILED").length;
    const totalTasks = session.tasks.length;
    if (totalTasks > 0 && completedTasks === totalTasks) {
      session.status = "COMPLETED";
      session.completedAt = Date.now();
      session.finalOutput = {
        completedTasks: session.tasks.filter((t) => t.status === "COMPLETED").map((t) => t.result),
        summary: {
          total: totalTasks,
          completed: completedTasks,
          failed: failedTasks
        }
      };
    } else if (failedTasks > totalTasks / 2) {
      session.status = "FAILED";
    }
    return session;
  }
  async terminateSession(sessionId) {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }
    session.status = "CANCELLED";
    session.completedAt = Date.now();
    session.tasks.forEach((task) => {
      if (task.status === "PENDING" || task.status === "IN_PROGRESS") {
        task.status = "CANCELLED";
      }
    });
    session.participatingAgents.forEach((agentId) => {
      if ("clearQueue" in this.messageQueue) {
        this.messageQueue.clearQueue(agentId);
      }
    });
    console.log(`[Orchestrator] Terminated session: ${sessionId}`);
  }
  /**
   * Execute a multi-agent workflow
   */
  async executeWorkflow(objective, agentRoles, initialTask) {
    const agentIds = [];
    for (const role of agentRoles) {
      const agents = this.registry.getAgentsByRole(role);
      const available = agents.find((a) => a.state.status === "IDLE");
      if (available) {
        agentIds.push(available.config.id);
      } else if (agents.length > 0) {
        agentIds.push(agents[0].config.id);
      }
    }
    if (agentIds.length === 0) {
      throw new Error("No available agents for the requested roles");
    }
    const session = await this.createSession(objective, agentIds);
    const task = {
      ...initialTask,
      id: v4(),
      assignedTo: agentIds[0],
      status: "PENDING",
      createdAt: Date.now()
    };
    await this.assignTask(session.sessionId, task);
    return await this.getSessionStatus(session.sessionId);
  }
  /**
   * Cleanup stale sessions
   */
  cleanupStaleSessions() {
    const now = Date.now();
    this.sessions.forEach((session, sessionId) => {
      const age = now - session.createdAt;
      if (age > this.SESSION_TIMEOUT_MS && session.status !== "COMPLETED" && session.status !== "FAILED" && session.status !== "CANCELLED") {
        console.log(`[Orchestrator] Cleaning up stale session: ${sessionId}`);
        session.status = "FAILED";
        session.errors.push({
          agentId: "SYSTEM",
          error: "Session timeout",
          timestamp: now
        });
      }
    });
  }
  /**
   * Get all active sessions
   */
  getActiveSessions() {
    return Array.from(this.sessions.values()).filter(
      (s) => s.status === "IN_PROGRESS" || s.status === "INITIATED"
    );
  }
  /**
   * Get orchestrator statistics
   */
  getStats() {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter((s) => s.status === "IN_PROGRESS").length,
      completedSessions: sessions.filter((s) => s.status === "COMPLETED").length,
      failedSessions: sessions.filter((s) => s.status === "FAILED").length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageQueue.length, 0),
      totalTasks: sessions.reduce((sum, s) => sum + s.tasks.length, 0),
      registryHealth: this.registry.getHealthStatus(),
      queueStats: this.messageQueue.getAllQueuesStats()
    };
  }
}
function createMultiAgentSystem(agentConfigs) {
  const registry2 = new AgentRegistry();
  const messageQueue2 = new MessageQueue();
  const orchestrator2 = new MultiAgentOrchestrator(registry2, messageQueue2);
  import("../../../../../chunks/base-agents.js").then(({ createAgentByRole }) => {
    agentConfigs.forEach((config) => {
      try {
        const agent = createAgentByRole(config.role, config);
        registry2.register(agent);
      } catch (error) {
        console.error(`Failed to create agent ${config.role}:`, error);
      }
    });
  }).catch((error) => {
    console.error("Failed to load agent modules:", error);
  });
  return { registry: registry2, messageQueue: messageQueue2, orchestrator: orchestrator2 };
}
let registry = null;
let messageQueue = null;
let orchestrator = null;
function getAgentSystem() {
  if (!registry || !messageQueue || !orchestrator) {
    const defaultAgentConfigs = [
      {
        id: v4(),
        role: "RESEARCHER",
        name: "Research Agent",
        description: "Gathers information from external sources",
        capabilities: ["web_search", "database_query", "api_call"],
        maxConcurrentTasks: 3,
        timeoutMs: 3e4,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: v4(),
        role: "ANALYST",
        name: "Analysis Agent",
        description: "Analyzes data and finds patterns",
        capabilities: ["data_analysis", "pattern_recognition", "statistical_analysis"],
        maxConcurrentTasks: 2,
        timeoutMs: 45e3,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: v4(),
        role: "VALIDATOR",
        name: "Validation Agent",
        description: "Validates facts and cross-references sources",
        capabilities: ["fact_checking", "source_verification", "consistency_check"],
        maxConcurrentTasks: 5,
        timeoutMs: 2e4,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: v4(),
        role: "SYNTHESIZER",
        name: "Synthesis Agent",
        description: "Combines findings into coherent output",
        capabilities: ["content_synthesis", "report_generation", "summary_creation"],
        maxConcurrentTasks: 2,
        timeoutMs: 6e4,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: v4(),
        role: "PLANNER",
        name: "Planning Agent",
        description: "Breaks down complex tasks into steps",
        capabilities: ["task_decomposition", "workflow_planning", "dependency_mapping"],
        maxConcurrentTasks: 1,
        timeoutMs: 3e4,
        retryAttempts: 3,
        enabled: true
      },
      {
        id: v4(),
        role: "CRITIC",
        name: "Critic Agent",
        description: "Reviews and provides feedback on outputs",
        capabilities: ["quality_review", "error_detection", "improvement_suggestions"],
        maxConcurrentTasks: 3,
        timeoutMs: 3e4,
        retryAttempts: 2,
        enabled: true
      },
      {
        id: v4(),
        role: "COORDINATOR",
        name: "Coordinator Agent",
        description: "Manages communication between agents",
        capabilities: ["task_routing", "load_balancing", "conflict_resolution"],
        maxConcurrentTasks: 10,
        timeoutMs: 15e3,
        retryAttempts: 5,
        enabled: true
      }
    ];
    const system = createMultiAgentSystem(defaultAgentConfigs);
    registry = system.registry;
    messageQueue = system.messageQueue;
    orchestrator = system.orchestrator;
  }
  return { registry, messageQueue, orchestrator };
}
const POST = async ({ request }) => {
  try {
    const body = await request.json();
    const { objective, agentRoles, task } = body;
    if (!objective) {
      return json({ error: "Objective is required" }, { status: 400 });
    }
    const { orchestrator: orch } = getAgentSystem();
    const roles = agentRoles || ["RESEARCHER", "ANALYST", "VALIDATOR", "SYNTHESIZER"];
    const initialTask = {
      taskType: task?.taskType || "research_query",
      input: task?.input || { query: objective },
      metadata: task?.metadata || {}
    };
    const session = await orch.executeWorkflow(objective, roles, initialTask);
    return json({
      success: true,
      sessionId: session.sessionId,
      status: session.status,
      objective: session.objective,
      participatingAgents: session.participatingAgents.length,
      tasks: session.tasks.length,
      createdAt: session.createdAt
    });
  } catch (error) {
    console.error("[API] Orchestration error:", error);
    return json({
      error: error instanceof Error ? error.message : "Orchestration failed"
    }, { status: 500 });
  }
};
const GET = async ({ params, url }) => {
  try {
    const { orchestrator: orch } = getAgentSystem();
    const sessionId = params.sessionId || url.searchParams.get("sessionId");
    if (sessionId) {
      try {
        const session = await orch.getSessionStatus(sessionId);
        return json({
          success: true,
          session
        });
      } catch (error) {
        return json({
          error: "Session not found",
          details: error instanceof Error ? error.message : "Unknown error"
        }, { status: 404 });
      }
    }
    const activeSessions = orch.getActiveSessions();
    const stats = orch.getStats();
    return json({
      success: true,
      activeSessions,
      stats
    });
  } catch (error) {
    console.error("[API] Get session error:", error);
    return json({
      error: error instanceof Error ? error.message : "Failed to get session"
    }, { status: 500 });
  }
};
const DELETE = async ({ params }) => {
  try {
    const { sessionId } = params;
    if (!sessionId) {
      return json({ error: "Session ID is required" }, { status: 400 });
    }
    const { orchestrator: orch } = getAgentSystem();
    await orch.terminateSession(sessionId);
    return json({
      success: true,
      message: "Session terminated successfully"
    });
  } catch (error) {
    console.error("[API] Terminate session error:", error);
    return json({
      error: error instanceof Error ? error.message : "Failed to terminate session"
    }, { status: 500 });
  }
};
export {
  DELETE,
  GET,
  POST
};
