// ============================================
// RETRY MANAGER - Backoff Exponencial e Circuit Breaker
// ============================================

interface RetryConfig {
  maxRetries: number;
  initialDelay: number; // ms
  maxDelay: number; // ms
  backoffMultiplier: number;
  retryableStatusCodes: number[];
}

interface CircuitBreakerState {
  state: 'closed' | 'open' | 'half-open';
  failures: number;
  lastFailureTime: number;
  nextAttemptTime: number;
}

/**
 * Sistema de retry com backoff exponencial e circuit breaker
 * Trata erros 429 e outros erros de forma elegante
 */
export class RetryManager {
  private circuitBreakers: Map<string, CircuitBreakerState> = new Map();
  
  // Configurações padrão
  private defaultConfig: RetryConfig = {
    maxRetries: 3,
    initialDelay: 1000, // 1s
    maxDelay: 60000, // 60s
    backoffMultiplier: 2,
    retryableStatusCodes: [429, 500, 502, 503, 504], // Rate limit e erros de servidor
  };

  // Circuit breaker config
  private circuitBreakerConfig = {
    failureThreshold: 5, // Abrir após 5 falhas
    resetTimeout: 30000, // Tentar resetar após 30s
    halfOpenMaxAttempts: 2, // Máximo de tentativas em half-open
  };

  /**
   * Executa função com retry e backoff exponencial
   */
  async executeWithRetry<T>(
    fn: () => Promise<T>,
    context: string = 'unknown',
    config?: Partial<RetryConfig>
  ): Promise<T> {
    const retryConfig = { ...this.defaultConfig, ...config };
    let lastError: Error | null = null;

    // Verificar circuit breaker
    const circuitState = this.getCircuitBreakerState(context);
    if (circuitState.state === 'open') {
      const now = Date.now();
      if (now < circuitState.nextAttemptTime) {
        const waitTime = Math.ceil((circuitState.nextAttemptTime - now) / 1000);
        throw new Error(
          `Circuit breaker aberto para ${context}. Tente novamente em ${waitTime}s`
        );
      } else {
        // Tentar half-open
        this.setCircuitBreakerState(context, 'half-open', circuitState.failures);
        console.log(`[RetryManager] 🔄 Circuit breaker em half-open para ${context}`);
      }
    }

    for (let attempt = 0; attempt <= retryConfig.maxRetries; attempt++) {
      try {
        const result = await fn();
        
        // Sucesso: resetar circuit breaker
        if (circuitState.state === 'half-open' || circuitState.failures > 0) {
          this.resetCircuitBreaker(context);
          console.log(`[RetryManager] ✅ Circuit breaker resetado para ${context}`);
        }

        return result;
      } catch (error: any) {
        lastError = error;

        // Verificar se é erro retryable
        const statusCode = this.extractStatusCode(error);
        const isRetryable = retryConfig.retryableStatusCodes.includes(statusCode);

        if (!isRetryable && attempt < retryConfig.maxRetries) {
          // Erro não retryable, mas ainda há tentativas
          console.log(`[RetryManager] ⚠️ Erro não retryable (${statusCode}), mas tentando novamente...`);
        }

        if (!isRetryable || attempt >= retryConfig.maxRetries) {
          // Não retryable ou sem mais tentativas
          this.recordFailure(context);
          throw error;
        }

        // Calcular delay com backoff exponencial
        const delay = Math.min(
          retryConfig.initialDelay * Math.pow(retryConfig.backoffMultiplier, attempt),
          retryConfig.maxDelay
        );

        // Adicionar jitter aleatório (0-20% do delay)
        const jitter = delay * 0.2 * Math.random();
        const finalDelay = delay + jitter;

        console.log(
          `[RetryManager] ⏳ Retry ${attempt + 1}/${retryConfig.maxRetries} para ${context} após ${Math.round(finalDelay)}ms (status: ${statusCode})`
        );

        await this.sleep(finalDelay);
      }
    }

    // Todas as tentativas falharam
    this.recordFailure(context);
    throw lastError || new Error('Todas as tentativas falharam');
  }

  /**
   * Extrai status code do erro
   */
  private extractStatusCode(error: any): number {
    if (error?.status) return error.status;
    if (error?.statusCode) return error.statusCode;
    if (error?.response?.status) return error.response.status;
    if (error?.message?.includes('429')) return 429;
    if (error?.message?.includes('500')) return 500;
    if (error?.message?.includes('502')) return 502;
    if (error?.message?.includes('503')) return 503;
    if (error?.message?.includes('504')) return 504;
    return 0; // Desconhecido
  }

  /**
   * Registra falha no circuit breaker
   */
  private recordFailure(context: string): void {
    const state = this.getCircuitBreakerState(context);
    state.failures++;
    state.lastFailureTime = Date.now();

    if (state.failures >= this.circuitBreakerConfig.failureThreshold) {
      if (state.state !== 'open') {
        this.setCircuitBreakerState(context, 'open', state.failures);
        console.log(`[RetryManager] 🔴 Circuit breaker ABERTO para ${context} (${state.failures} falhas)`);
      }
      state.nextAttemptTime = Date.now() + this.circuitBreakerConfig.resetTimeout;
    }
  }

  /**
   * Reseta circuit breaker após sucesso
   */
  private resetCircuitBreaker(context: string): void {
    this.setCircuitBreakerState(context, 'closed', 0);
  }

  /**
   * Obtém estado do circuit breaker
   */
  private getCircuitBreakerState(context: string): CircuitBreakerState {
    if (!this.circuitBreakers.has(context)) {
      this.circuitBreakers.set(context, {
        state: 'closed',
        failures: 0,
        lastFailureTime: 0,
        nextAttemptTime: 0,
      });
    }
    return this.circuitBreakers.get(context)!;
  }

  /**
   * Define estado do circuit breaker
   */
  private setCircuitBreakerState(
    context: string,
    state: 'closed' | 'open' | 'half-open',
    failures: number
  ): void {
    const current = this.getCircuitBreakerState(context);
    current.state = state;
    current.failures = failures;
    if (state === 'open') {
      current.nextAttemptTime = Date.now() + this.circuitBreakerConfig.resetTimeout;
    }
  }

  /**
   * Sleep helper
   */
  private sleep(ms: number): Promise<void> {
    return new Promise(resolve => setTimeout(resolve, ms));
  }

  /**
   * Obtém estatísticas do circuit breaker
   */
  getCircuitBreakerStats(context: string) {
    const state = this.getCircuitBreakerState(context);
    return {
      state: state.state,
      failures: state.failures,
      lastFailureTime: state.lastFailureTime,
      nextAttemptTime: state.nextAttemptTime,
    };
  }

  /**
   * Reseta circuit breaker manualmente
   */
  resetCircuitBreakerManually(context: string): void {
    this.resetCircuitBreaker(context);
    console.log(`[RetryManager] 🔄 Circuit breaker resetado manualmente para ${context}`);
  }
}

export const retryManager = new RetryManager();


