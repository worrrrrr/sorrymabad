import { fork, ChildProcess } from 'child_process';
import type { WorkerTask, WorkerResult } from '$lib/types/pipeline';

/**
 * Heavy Worker Pool for CPU-intensive tasks (Z3 Solver, WASM, etc.)
 * Uses child_process.fork with memory isolation and reset capabilities
 */

export interface WorkerPoolConfig {
	maxWorkers: number;
	minWorkers: number;
	maxTasksPerWorker: number;
	memoryLimitMB: number;
	taskTimeout: number;
	idleTimeout: number;
}

const DEFAULT_CONFIG: WorkerPoolConfig = {
	maxWorkers: 4,
	minWorkers: 1,
	maxTasksPerWorker: 100,
	memoryLimitMB: 512,
	taskTimeout: 60000,
	idleTimeout: 300000
};

export interface WorkerInfo {
	id: string;
	process: ChildProcess;
	taskCount: number;
	busy: boolean;
	lastActive: number;
	memoryUsage: number;
}

export interface PoolStats {
	totalWorkers: number;
	busyWorkers: number;
	idleWorkers: number;
	queuedTasks: number;
	totalTasksProcessed: number;
	averageExecutionTime: number;
}

type TaskResolver = (result: WorkerResult) => void;
type TaskRejector = (error: Error) => void;

interface PendingTask {
	task: WorkerTask;
	resolve: TaskResolver;
	reject: TaskRejector;
}

/**
 * Worker pool manager for heavy computational tasks
 */
export class HeavyWorkerPool {
	private config: WorkerPoolConfig;
	private workers: Map<string, WorkerInfo>;
	private taskQueue: PendingTask[];
	private stats: {
		totalProcessed: number;
		totalExecutionTime: number;
	};
	private shutdown: boolean;

	constructor(config?: Partial<WorkerPoolConfig>) {
		this.config = { ...DEFAULT_CONFIG, ...config };
		this.workers = new Map();
		this.taskQueue = [];
		this.stats = {
			totalProcessed: 0,
			totalExecutionTime: 0
		};
		this.shutdown = false;

		// Initialize minimum workers
		this.initializeMinWorkers();
	}

	/**
	 * Initialize minimum number of workers
	 */
	private async initializeMinWorkers(): Promise<void> {
		for (let i = 0; i < this.config.minWorkers; i++) {
			await this.spawnWorker();
		}
	}

	/**
	 * Spawn a new worker process
	 */
	private async spawnWorker(): Promise<string> {
		const workerId = `worker-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
		
		// Fork the worker script (path to be configured based on deployment)
		const workerPath = process.env.WORKER_SCRIPT_PATH || './heavy-worker.js';
		
		try {
			const child = fork(workerPath, [], {
				env: {
					...process.env,
					WORKER_ID: workerId,
					MEMORY_LIMIT_MB: String(this.config.memoryLimitMB)
				},
				silent: true
			});

			const workerInfo: WorkerInfo = {
				id: workerId,
				process: child,
				taskCount: 0,
				busy: false,
				lastActive: Date.now(),
				memoryUsage: 0
			};

			// Set up message handler
			child.on('message', (message) => this.handleWorkerMessage(workerId, message));
			
			// Handle worker exit
			child.on('exit', () => {
				this.workers.delete(workerId);
				if (!this.shutdown && this.workers.size < this.config.minWorkers) {
					this.spawnWorker();
				}
			});

			// Handle errors
			child.on('error', (error) => {
				console.error(`Worker ${workerId} error:`, error);
				this.retireWorker(workerId);
			});

			this.workers.set(workerId, workerInfo);
			return workerId;
		} catch (error) {
			console.error('Failed to spawn worker:', error);
			throw error;
		}
	}

	/**
	 * Handle messages from workers
	 */
	private handleWorkerMessage(workerId: string, message: any): void {
		const worker = this.workers.get(workerId);
		if (!worker) return;

		worker.lastActive = Date.now();

		if (message.type === 'task_complete') {
			worker.busy = false;
			worker.taskCount++;
			worker.memoryUsage = message.memoryUsage || 0;

			// Update stats
			this.stats.totalProcessed++;
			this.stats.totalExecutionTime += message.executionTime || 0;

			// Find pending task resolver
			const pendingIndex = this.taskQueue.findIndex(
				(p) => p.task.taskId === message.taskId
			);

			if (pendingIndex >= 0) {
				const pending = this.taskQueue.splice(pendingIndex, 1)[0];
				
				if (message.success) {
					pending.resolve({
						taskId: message.taskId,
						success: true,
						result: message.result,
						executionTime: message.executionTime,
						memoryUsed: message.memoryUsage
					});
				} else {
					pending.resolve({
						taskId: message.taskId,
						success: false,
						error: message.error,
						executionTime: message.executionTime,
						memoryUsed: message.memoryUsage
					});
				}
			}

			// Check if worker needs retirement
			if (worker.taskCount >= this.config.maxTasksPerWorker) {
				this.retireWorker(workerId);
			}

			// Process next queued task
			this.processQueue();
		} else if (message.type === 'memory_warning') {
			// Worker is running low on memory, retire it after current task
			worker.taskCount = this.config.maxTasksPerWorker;
		}
	}

	/**
	 * Retire a worker (graceful shutdown and replacement)
	 */
	private async retireWorker(workerId: string): Promise<void> {
		const worker = this.workers.get(workerId);
		if (!worker) return;

		// Send shutdown signal
		worker.process.send({ type: 'shutdown' });

		// Give worker time to finish current task
		setTimeout(() => {
			if (!worker.process.killed) {
				worker.process.kill();
			}
		}, 5000);

		// Spawn replacement if needed
		if (!this.shutdown && this.workers.size <= this.config.minWorkers) {
			await this.spawnWorker();
		}
	}

	/**
	 * Reset worker memory by retiring and replacing it
	 */
	async resetWorkerMemory(workerId: string): Promise<void> {
		await this.retireWorker(workerId);
	}

	/**
	 * Submit a task to the pool
	 */
	async submitTask(task: WorkerTask): Promise<WorkerResult> {
		if (this.shutdown) {
			throw new Error('Worker pool is shutting down');
		}

		return new Promise((resolve, reject) => {
			// Add to queue
			this.taskQueue.push({ task, resolve, reject });
			
			// Try to process immediately
			this.processQueue();
		});
	}

	/**
	 * Process queued tasks
	 */
	private processQueue(): void {
		if (this.taskQueue.length === 0) return;

		// Find an idle worker
		for (const [workerId, worker] of this.workers) {
			if (!worker.busy && this.taskQueue.length > 0) {
				const pending = this.taskQueue.shift()!;
				this.dispatchTask(workerId, pending);
			}
		}

		// If no idle workers and queue is growing, spawn new worker (up to max)
		if (
			this.taskQueue.length > 0 &&
			this.workers.size < this.config.maxWorkers
		) {
			this.spawnWorker().then(() => this.processQueue());
		}
	}

	/**
	 * Dispatch task to a specific worker
	 */
	private dispatchTask(workerId: string, pending: PendingTask): void {
		const worker = this.workers.get(workerId);
		if (!worker) {
			// Worker disappeared, requeue task
			this.taskQueue.unshift(pending);
			return;
		}

		worker.busy = true;
		worker.lastActive = Date.now();

		// Send task to worker
		worker.process.send({
			type: 'execute_task',
			task: pending.task
		});

		// Set timeout
		const timeoutId = setTimeout(() => {
			if (worker.busy) {
				// Task timed out
				const index = this.taskQueue.findIndex(
					(p) => p.task.taskId === pending.task.taskId
				);
				
				if (index >= 0) {
					this.taskQueue.splice(index, 1);
					pending.reject(new Error(`Task ${pending.task.taskId} timed out`));
				}

				// Kill and replace worker
				this.retireWorker(workerId);
			}
		}, pending.task.timeout || this.config.taskTimeout);

		// Clear timeout when task completes (handled in message handler)
		const originalResolve = pending.resolve;
		pending.resolve = (result) => {
			clearTimeout(timeoutId);
			originalResolve(result);
		};

		const originalReject = pending.reject;
		pending.reject = (error) => {
			clearTimeout(timeoutId);
			originalReject(error);
		};
	}

	/**
	 * Get pool statistics
	 */
	getStats(): PoolStats {
		const busyWorkers = Array.from(this.workers.values()).filter(
			(w) => w.busy
		).length;

		return {
			totalWorkers: this.workers.size,
			busyWorkers,
			idleWorkers: this.workers.size - busyWorkers,
			queuedTasks: this.taskQueue.length,
			totalTasksProcessed: this.stats.totalProcessed,
			averageExecutionTime:
				this.stats.totalProcessed > 0
					? this.stats.totalExecutionTime / this.stats.totalProcessed
					: 0
		};
	}

	/**
	 * Gracefully shutdown the pool
	 */
	async shutdown(): Promise<void> {
		this.shutdown = true;

		// Wait for queued tasks to complete or timeout
		await Promise.race([
			new Promise((resolve) => {
				const checkQueue = setInterval(() => {
					if (this.taskQueue.length === 0) {
						clearInterval(checkQueue);
						resolve(undefined);
					}
				}, 100);
			}),
			new Promise((_, reject) =>
				setTimeout(() => reject(new Error('Shutdown timeout')), 30000)
			)
		]);

		// Shutdown all workers
		const shutdownPromises = Array.from(this.workers.values()).map(
			(worker) =>
				new Promise<void>((resolve) => {
					worker.process.once('exit', () => resolve());
					worker.process.send({ type: 'shutdown' });
					setTimeout(() => {
						if (!worker.process.killed) {
							worker.process.kill();
						}
						resolve();
					}, 5000);
				})
		);

		await Promise.all(shutdownPromises);
		this.workers.clear();
	}
}

/**
 * Singleton instance for global worker pool
 */
let globalPool: HeavyWorkerPool | null = null;

export function getGlobalWorkerPool(config?: Partial<WorkerPoolConfig>): HeavyWorkerPool {
	if (!globalPool) {
		globalPool = new HeavyWorkerPool(config);
	}
	return globalPool;
}

export function destroyGlobalWorkerPool(): void {
	if (globalPool) {
		globalPool.shutdown();
		globalPool = null;
	}
}
