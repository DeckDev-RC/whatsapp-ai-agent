// ============================================
// QUEUE MANAGER - Sistema de Fila com Workers
// ============================================

import type { AIProvider } from '../../shared/types';

interface QueueJob<T = any> {
  id: string;
  type: 'llm_request' | 'embedding' | 'function_call';
  provider?: AIProvider;
  payload: T;
  priority: number; // 1-10, maior = mais prioritário
  createdAt: number;
  retries: number;
  maxRetries: number;
}

interface WorkerConfig {
  concurrency: number; // Número de workers simultâneos
  rateLimitRPM: number; // Requests por minuto
  batchSize?: number; // Tamanho do batch (se aplicável)
}

type JobProcessor<T, R> = (job: QueueJob<T>) => Promise<R>;

/**
 * Sistema de fila com workers para controlar concorrência e taxa de requisições
 * Enfileira requests que exigem LLM; workers controlam taxa e batching
 */
export class QueueManager {
  private queues: Map<string, QueueJob[]> = new Map();
  private workers: Map<string, WorkerConfig> = new Map();
  private processing: Map<string, Set<string>> = new Map(); // Jobs em processamento
  private rateLimiters: Map<string, number[]> = new Map(); // Histórico de requisições por worker

  // Callbacks de processamento
  private processors: Map<string, JobProcessor<any, any>> = new Map();

  constructor() {
    // Iniciar workers para cada provider
    this.initializeWorkers();
  }

  /**
   * Inicializa workers com configurações padrão por provider
   */
  private initializeWorkers(): void {
    // Configurações conservadoras baseadas em quotas conhecidas
    const defaultConfigs: Record<AIProvider, WorkerConfig> = {
      gemini: {
        concurrency: 2, // Conservador para evitar 429
        rateLimitRPM: 12, // Abaixo do limite de 15 RPM
        batchSize: 5,
      },
      openai: {
        concurrency: 3,
        rateLimitRPM: 50, // Abaixo do limite típico
        batchSize: 10,
      },
      claude: {
        concurrency: 2,
        rateLimitRPM: 40,
        batchSize: 5,
      },
      openrouter: {
        concurrency: 2,
        rateLimitRPM: 30,
        batchSize: 5,
      },
    };

    Object.entries(defaultConfigs).forEach(([provider, config]) => {
      this.workers.set(provider, config);
      this.queues.set(provider, []);
      this.processing.set(provider, new Set());
      this.rateLimiters.set(provider, []);
    });

    // Iniciar processamento
    this.startWorkers();
  }

  /**
   * Adiciona job à fila
   */
  async enqueue<T, R>(
    type: string,
    provider: AIProvider,
    payload: T,
    priority: number = 5,
    processor: JobProcessor<T, R>
  ): Promise<R> {
    const job: QueueJob<T> = {
      id: `${provider}_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      type: type as any,
      provider,
      payload,
      priority,
      createdAt: Date.now(),
      retries: 0,
      maxRetries: 3,
    };

    // Retornar promise que será resolvida quando o job for processado
    return new Promise<R>((resolve, reject) => {
      // Armazenar callbacks no job
      (job as any).resolve = resolve;
      (job as any).reject = reject;

      const queue = this.queues.get(provider) || [];
      queue.push(job);
      
      // Ordenar por prioridade (maior primeiro)
      queue.sort((a, b) => b.priority - a.priority);
      
      this.queues.set(provider, queue);
      this.processors.set(job.id, processor);

      console.log(`[QueueManager] 📥 Job enfileirado: ${job.id} (prioridade: ${priority})`);
    });
  }

  /**
   * Inicia workers para processar filas
   */
  private startWorkers(): void {
    this.workers.forEach((config, provider) => {
      // Criar múltiplos workers baseado na concorrência
      for (let i = 0; i < config.concurrency; i++) {
        this.processQueue(provider as AIProvider, i);
      }
    });
  }

  /**
   * Processa fila de um provider
   */
  private async processQueue(provider: AIProvider, workerId: number): Promise<void> {
    const queue = this.queues.get(provider);
    const config = this.workers.get(provider);
    const processing = this.processing.get(provider) || new Set();
    const rateLimiter = this.rateLimiters.get(provider) || [];

    if (!queue || !config) return;

    while (true) {
      // Verificar rate limit
      const now = Date.now();
      const recentRequests = rateLimiter.filter(time => now - time < 60000); // Últimos 60s
      
      if (recentRequests.length >= config.rateLimitRPM) {
        // Rate limit atingido, aguardar
        const oldestRequest = Math.min(...rateLimiter);
        const waitTime = 60000 - (now - oldestRequest);
        console.log(`[QueueManager] ⏳ Rate limit atingido para ${provider}, aguardando ${Math.round(waitTime / 1000)}s`);
        await this.sleep(waitTime);
        continue;
      }

      // Buscar próximo job
      const job = queue.find(j => !processing.has(j.id));
      
      if (!job) {
        // Fila vazia, aguardar um pouco
        await this.sleep(1000);
        continue;
      }

      // Marcar como processando
      processing.add(job.id);
      queue.splice(queue.indexOf(job), 1);

      // Registrar requisição no rate limiter
      rateLimiter.push(now);
      // Manter apenas últimos 100 registros
      if (rateLimiter.length > 100) {
        rateLimiter.shift();
      }

      // Processar job
      const processor = this.processors.get(job.id);
      if (processor) {
        try {
          console.log(`[QueueManager] 🔄 Worker ${workerId} processando job ${job.id} (${provider})`);
          const result = await processor(job);
          
          // Resolver promise do job
          if ((job as any).resolve) {
            (job as any).resolve(result);
          }

          console.log(`[QueueManager] ✅ Job ${job.id} concluído com sucesso`);
        } catch (error) {
          console.error(`[QueueManager] ❌ Erro ao processar job ${job.id}:`, error);
          
          // Retry se possível
          if (job.retries < job.maxRetries) {
            job.retries++;
            queue.push(job); // Re-enfileirar
            console.log(`[QueueManager] 🔄 Re-enfileirando job ${job.id} (tentativa ${job.retries}/${job.maxRetries})`);
          } else {
            // Rejeitar promise do job
            if ((job as any).reject) {
              (job as any).reject(error);
            }
            console.log(`[QueueManager] ❌ Job ${job.id} falhou após ${job.maxRetries} tentativas`);
          }
        } finally {
          processing.delete(job.id);
        }
      } else {
        console.error(`[QueueManager] ⚠️ Processor não encontrado para job ${job.id}`);
        processing.delete(job.id);
      }

      // Pequeno delay entre jobs
      await this.sleep(100);
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém estatísticas da fila
   */
  getQueueStats(provider?: AIProvider) {
    const stats: Record<string, any> = {};

    const providers = provider ? [provider] : Array.from(this.workers.keys());

    providers.forEach(prov => {
      const queue = this.queues.get(prov) || [];
      const processing = this.processing.get(prov) || new Set();
      const config = this.workers.get(prov);
      const rateLimiter = this.rateLimiters.get(prov) || [];

      const now = Date.now();
      const recentRequests = rateLimiter.filter(time => now - time < 60000);

      stats[prov] = {
        queueSize: queue.length,
        processing: processing.size,
        concurrency: config?.concurrency || 0,
        rateLimitRPM: config?.rateLimitRPM || 0,
        currentRPM: recentRequests.length,
        averageWaitTime: this.calculateAverageWaitTime(queue),
      };
    });

    return stats;
  }

  /**
   * Calcula tempo médio de espera na fila
   */
  private calculateAverageWaitTime(queue: QueueJob[]): number {
    if (queue.length === 0) return 0;
    const now = Date.now();
    const totalWait = queue.reduce((sum, job) => sum + (now - job.createdAt), 0);
    return Math.round(totalWait / queue.length);
  }

  /**
   * Limpa fila de um provider
   */
  clearQueue(provider: AIProvider): void {
    const queue = this.queues.get(provider);
    if (queue) {
      queue.length = 0;
      console.log(`[QueueManager] 🗑️ Fila limpa para ${provider}`);
    }
  }
}

export const queueManager = new QueueManager();

