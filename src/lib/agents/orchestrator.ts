import type { 
  AgentConfig, 
  AgentState, 
  AgentTask, 
  AgentResponse,
  AgentMessage,
  OrchestrationSession,
  IAgent,
  IAgentRegistry,
  IMessageQueue,
  IOrchestrator
} from '$lib/types/agents';
import { v4 as uuidv4 } from 'uuid';

/**
 * In-Memory Agent Registry
 * Manages registration and discovery of agents
 */
export class AgentRegistry implements IAgentRegistry {
  private agents: Map<string, IAgent> = new Map();
  private agentsByRole: Map<string, IAgent[]> = new Map();

  register(agent: IAgent): void {
    if (!agent.config.enabled) {
      throw new Error(`Cannot register disabled agent: ${agent.config.id}`);
    }

    this.agents.set(agent.config.id, agent);

    // Index by role
    const role = agent.config.role;
    const roleAgents = this.agentsByRole.get(role) || [];
    roleAgents.push(agent);
    this.agentsByRole.set(role, roleAgents);

    console.log(`[Registry] Registered agent: ${agent.config.name} (${agent.config.role})`);
  }

  unregister(agentId: string): void {
    const agent = this.agents.get(agentId);
    if (agent) {
      this.agents.delete(agentId);
      
      // Remove from role index
      const roleAgents = this.agentsByRole.get(agent.config.role);
      if (roleAgents) {
        const filtered = roleAgents.filter(a => a.config.id !== agentId);
        this.agentsByRole.set(agent.config.role, filtered);
      }

      console.log(`[Registry] Unregistered agent: ${agent.config.name}`);
    }
  }

  getAgent(agentId: string): IAgent | undefined {
    return this.agents.get(agentId);
  }

  getAgentsByRole(role: string): IAgent[] {
    return this.agentsByRole.get(role) || [];
  }

  getAllAgents(): IAgent[] {
    return Array.from(this.agents.values());
  }

  getAvailableAgents(): IAgent[] {
    return this.getAllAgents().filter(
      agent => agent.state.status === 'IDLE' && agent.config.enabled
    );
  }

  getHealthStatus(): Record<string, any> {
    const agents = this.getAllAgents();
    return {
      totalAgents: agents.length,
      availableAgents: agents.filter(a => a.state.status === 'IDLE').length,
      busyAgents: agents.filter(a => a.state.status === 'BUSY').length,
      errorAgents: agents.filter(a => a.state.status === 'ERROR').length,
      averageHealthScore: agents.reduce((sum, a) => sum + a.state.healthScore, 0) / agents.length,
      agentsByRole: Object.fromEntries(
        Array.from(this.agentsByRole.entries()).map(([role, agents]) => [role, agents.length])
      )
    };
  }
}

/**
 * Priority Message Queue for Inter-Agent Communication
 */
export class MessageQueue implements IMessageQueue {
  private queues: Map<string, AgentMessage[]> = new Map();
  private readonly MAX_QUEUE_SIZE = 1000;

  async enqueue(message: AgentMessage): Promise<void> {
    const queue = this.queues.get(message.toAgentId) || [];
    
    if (queue.length >= this.MAX_QUEUE_SIZE) {
      // Remove oldest low-priority messages if queue is full
      const lowPriorityIndex = queue.findIndex(m => m.priority === 'LOW');
      if (lowPriorityIndex !== -1) {
        queue.splice(lowPriorityIndex, 1);
      } else {
        throw new Error(`Message queue full for agent: ${message.toAgentId}`);
      }
    }

    // Insert based on priority
    const priorityOrder = ['CRITICAL', 'HIGH', 'NORMAL', 'LOW'];
    const insertIndex = queue.findIndex(
      m => priorityOrder.indexOf(m.priority) < priorityOrder.indexOf(message.priority)
    );

    if (insertIndex === -1) {
      queue.push(message);
    } else {
      queue.splice(insertIndex, 0, message);
    }

    this.queues.set(message.toAgentId, queue);
  }

  async dequeue(agentId: string): Promise<AgentMessage | null> {
    const queue = this.queues.get(agentId) || [];
    if (queue.length === 0) {
      return null;
    }

    const message = queue.shift()!;
    this.queues.set(agentId, queue);
    return message;
  }

  async peek(agentId: string): Promise<AgentMessage | null> {
    const queue = this.queues.get(agentId) || [];
    return queue.length > 0 ? queue[0] : null;
  }

  async getMessageCount(agentId: string): Promise<number> {
    const queue = this.queues.get(agentId) || [];
    return queue.length;
  }

  clearQueue(agentId: string): void {
    this.queues.set(agentId, []);
  }

  getAllQueuesStats(): Record<string, number> {
    const stats: Record<string, number> = {};
    this.queues.forEach((queue, agentId) => {
      stats[agentId] = queue.length;
    });
    return stats;
  }
}

/**
 * Multi-Agent Orchestrator
 * Coordinates communication and task execution between agents
 */
export class MultiAgentOrchestrator implements IOrchestrator {
  private sessions: Map<string, OrchestrationSession> = new Map();
  private registry: IAgentRegistry;
  private messageQueue: IMessageQueue;
  private readonly SESSION_TIMEOUT_MS = 30 * 60 * 1000; // 30 minutes

  constructor(registry: IAgentRegistry, messageQueue: IMessageQueue) {
    this.registry = registry;
    this.messageQueue = messageQueue;
    
    // Start session cleanup interval
    setInterval(() => this.cleanupStaleSessions(), 60 * 1000);
  }

  async createSession(objective: string, agentIds: string[]): Promise<OrchestrationSession> {
    const sessionId = uuidv4();
    
    // Validate all agents exist
    const validAgents = agentIds.filter(id => {
      const agent = this.registry.getAgent(id);
      if (!agent) {
        console.warn(`[Orchestrator] Agent not found: ${id}`);
        return false;
      }
      return true;
    });

    if (validAgents.length === 0) {
      throw new Error('No valid agents provided for session');
    }

    const session: OrchestrationSession = {
      id: uuidv4(),
      sessionId,
      objective,
      participatingAgents: validAgents,
      messageQueue: [],
      tasks: [],
      status: 'INITIATED',
      createdAt: Date.now(),
      errors: []
    };

    this.sessions.set(sessionId, session);
    console.log(`[Orchestrator] Created session: ${sessionId} with ${validAgents.length} agents`);

    return session;
  }

  async assignTask(sessionId: string, task: AgentTask): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    if (session.status !== 'IN_PROGRESS' && session.status !== 'INITIATED') {
      throw new Error(`Cannot assign task to session in state: ${session.status}`);
    }

    // Update session status
    if (session.status === 'INITIATED') {
      session.status = 'IN_PROGRESS';
    }

    // Add task to session
    session.tasks.push(task);

    // Get target agent
    const agent = this.registry.getAgent(task.assignedTo);
    if (!agent) {
      throw new Error(`Agent not found: ${task.assignedTo}`);
    }

    // Execute task
    try {
      const response = await agent.execute(task);
      
      // Store result
      const taskIndex = session.tasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        session.tasks[taskIndex] = {
          ...session.tasks[taskIndex],
          status: response.success ? 'COMPLETED' : 'FAILED',
          startedAt: Date.now(),
          completedAt: Date.now(),
          result: response.data,
          error: response.error
        };
      }

      // Log errors
      if (!response.success) {
        session.errors.push({
          agentId: task.assignedTo,
          error: response.error || 'Unknown error',
          timestamp: Date.now()
        });
      }
    } catch (error) {
      session.errors.push({
        agentId: task.assignedTo,
        error: error instanceof Error ? error.message : 'Unknown error',
        timestamp: Date.now()
      });

      const taskIndex = session.tasks.findIndex(t => t.id === task.id);
      if (taskIndex !== -1) {
        session.tasks[taskIndex] = {
          ...session.tasks[taskIndex],
          status: 'FAILED',
          error: error instanceof Error ? error.message : 'Unknown error'
        };
      }
    }
  }

  async broadcastMessage(sessionId: string, message: AgentMessage): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Add to session message history
    session.messageQueue.push(message);

    // Deliver to target agent's queue
    await this.messageQueue.enqueue(message);

    console.log(`[Orchestrator] Broadcast message from ${message.fromAgentId} to ${message.toAgentId}`);
  }

  async getSessionStatus(sessionId: string): Promise<OrchestrationSession> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    // Update derived fields
    const completedTasks = session.tasks.filter(t => t.status === 'COMPLETED').length;
    const failedTasks = session.tasks.filter(t => t.status === 'FAILED').length;
    const totalTasks = session.tasks.length;

    if (totalTasks > 0 && completedTasks === totalTasks) {
      session.status = 'COMPLETED';
      session.completedAt = Date.now();
      
      // Aggregate final output from completed tasks
      session.finalOutput = {
        completedTasks: session.tasks.filter(t => t.status === 'COMPLETED').map(t => t.result),
        summary: {
          total: totalTasks,
          completed: completedTasks,
          failed: failedTasks
        }
      };
    } else if (failedTasks > totalTasks / 2) {
      session.status = 'FAILED';
    }

    return session;
  }

  async terminateSession(sessionId: string): Promise<void> {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw new Error(`Session not found: ${sessionId}`);
    }

    session.status = 'CANCELLED';
    session.completedAt = Date.now();

    // Cancel pending tasks
    session.tasks.forEach(task => {
      if (task.status === 'PENDING' || task.status === 'IN_PROGRESS') {
        task.status = 'CANCELLED';
      }
    });

    // Clear message queues for participating agents
    session.participatingAgents.forEach(agentId => {
      if ('clearQueue' in this.messageQueue) {
        (this.messageQueue as any).clearQueue(agentId);
      }
    });

    console.log(`[Orchestrator] Terminated session: ${sessionId}`);
  }

  /**
   * Execute a multi-agent workflow
   */
  async executeWorkflow(
    objective: string,
    agentRoles: string[],
    initialTask: Omit<AgentTask, 'id' | 'assignedTo' | 'status' | 'createdAt'>
  ): Promise<OrchestrationSession> {
    // Get agents by roles
    const agentIds: string[] = [];
    for (const role of agentRoles) {
      const agents = this.registry.getAgentsByRole(role);
      const available = agents.find(a => a.state.status === 'IDLE');
      if (available) {
        agentIds.push(available.config.id);
      } else if (agents.length > 0) {
        agentIds.push(agents[0].config.id);
      }
    }

    if (agentIds.length === 0) {
      throw new Error('No available agents for the requested roles');
    }

    // Create session
    const session = await this.createSession(objective, agentIds);

    // Assign initial task
    const task: AgentTask = {
      ...initialTask,
      id: uuidv4(),
      assignedTo: agentIds[0],
      status: 'PENDING',
      createdAt: Date.now()
    };

    await this.assignTask(session.sessionId, task);

    return await this.getSessionStatus(session.sessionId);
  }

  /**
   * Cleanup stale sessions
   */
  private cleanupStaleSessions(): void {
    const now = Date.now();
    this.sessions.forEach((session, sessionId) => {
      const age = now - session.createdAt;
      if (age > this.SESSION_TIMEOUT_MS && 
          session.status !== 'COMPLETED' && 
          session.status !== 'FAILED' &&
          session.status !== 'CANCELLED') {
        
        console.log(`[Orchestrator] Cleaning up stale session: ${sessionId}`);
        session.status = 'FAILED';
        session.errors.push({
          agentId: 'SYSTEM' as any,
          error: 'Session timeout',
          timestamp: now
        });
      }
    });
  }

  /**
   * Get all active sessions
   */
  getActiveSessions(): OrchestrationSession[] {
    return Array.from(this.sessions.values()).filter(
      s => s.status === 'IN_PROGRESS' || s.status === 'INITIATED'
    );
  }

  /**
   * Get orchestrator statistics
   */
  getStats(): Record<string, any> {
    const sessions = Array.from(this.sessions.values());
    return {
      totalSessions: sessions.length,
      activeSessions: sessions.filter(s => s.status === 'IN_PROGRESS').length,
      completedSessions: sessions.filter(s => s.status === 'COMPLETED').length,
      failedSessions: sessions.filter(s => s.status === 'FAILED').length,
      totalMessages: sessions.reduce((sum, s) => sum + s.messageQueue.length, 0),
      totalTasks: sessions.reduce((sum, s) => sum + s.tasks.length, 0),
      registryHealth: (this.registry as AgentRegistry).getHealthStatus(),
      queueStats: (this.messageQueue as MessageQueue).getAllQueuesStats()
    };
  }
}

/**
 * Factory function to create a complete multi-agent system
 */
export function createMultiAgentSystem(agentConfigs: AgentConfig[]): {
  registry: AgentRegistry;
  messageQueue: MessageQueue;
  orchestrator: MultiAgentOrchestrator;
} {
  const registry = new AgentRegistry();
  const messageQueue = new MessageQueue();
  const orchestrator = new MultiAgentOrchestrator(registry, messageQueue);

  // Import agent classes dynamically
  import('$lib/agents/base-agents').then(({ createAgentByRole }) => {
    agentConfigs.forEach(config => {
      try {
        const agent = createAgentByRole(config.role, config);
        registry.register(agent);
      } catch (error) {
        console.error(`Failed to create agent ${config.role}:`, error);
      }
    });
  }).catch(error => {
    console.error('Failed to load agent modules:', error);
  });

  return { registry, messageQueue, orchestrator };
}
