// ============================================
// OBSERVABILITY MANAGER - Métricas e Monitoramento
// ============================================

import type { AIProvider } from '../../shared/types';

interface Metric {
  endpoint: string;
  provider: AIProvider;
  userId?: string;
  timestamp: number;
  duration: number;
  success: boolean;
  statusCode?: number;
  errorType?: string;
  tokensUsed?: number;
  cost?: number;
}

interface Quota {
  provider: AIProvider;
  userId?: string;
  requests: number;
  tokens: number;
  errors: number;
  periodStart: number;
  periodEnd: number;
}

/**
 * Sistema de observability para métricas por endpoint, por usuário e alertas
 */
export class ObservabilityManager {
  private metrics: Metric[] = [];
  private quotas: Map<string, Quota> = new Map();
  private alerts: Array<{ type: string; message: string; timestamp: number }> = [];

  // Configurações
  private maxMetricsHistory = 10000; // Manter últimos 10k métricas
  private quotaPeriodMs = 3600000; // 1 hora
  private alertThresholds = {
    errorRate: 0.1, // 10% de erro
    latency: 5000, // 5s
    quotaUsage: 0.8, // 80% da quota
  };

  /**
   * Registra métrica de requisição
   */
  recordMetric(metric: Omit<Metric, 'timestamp'>): void {
    const fullMetric: Metric = {
      ...metric,
      timestamp: Date.now(),
    };

    this.metrics.push(fullMetric);

    // Limitar histórico
    if (this.metrics.length > this.maxMetricsHistory) {
      this.metrics = this.metrics.slice(-this.maxMetricsHistory);
    }

    // Atualizar quota
    this.updateQuota(fullMetric);

    // Verificar alertas
    this.checkAlerts(fullMetric);
  }

  /**
   * Atualiza quota do usuário/provider
   */
  private updateQuota(metric: Metric): void {
    const key = this.getQuotaKey(metric.provider, metric.userId);
    const now = Date.now();
    let quota = this.quotas.get(key);

    // Criar nova quota se não existir ou expirou
    if (!quota || now > quota.periodEnd) {
      quota = {
        provider: metric.provider,
        userId: metric.userId,
        requests: 0,
        tokens: 0,
        errors: 0,
        periodStart: now,
        periodEnd: now + this.quotaPeriodMs,
      };
    }

    quota.requests++;
    if (metric.tokensUsed) {
      quota.tokens += metric.tokensUsed;
    }
    if (!metric.success) {
      quota.errors++;
    }

    this.quotas.set(key, quota);
  }

  /**
   * Gera chave para quota
   */
  private getQuotaKey(provider: AIProvider, userId?: string): string {
    return `${provider}:${userId || 'global'}`;
  }

  /**
   * Verifica e gera alertas
   */
  private checkAlerts(metric: Metric): void {
    // Verificar latência
    if (metric.duration > this.alertThresholds.latency) {
      this.addAlert(
        'high_latency',
        `Latência alta detectada: ${metric.duration}ms para ${metric.endpoint} (${metric.provider})`
      );
    }

    // Verificar taxa de erro
    const recentMetrics = this.getRecentMetrics(metric.provider, 60000); // Último minuto
    if (recentMetrics.length > 10) {
      const errorRate = recentMetrics.filter(m => !m.success).length / recentMetrics.length;
      if (errorRate > this.alertThresholds.errorRate) {
        this.addAlert(
          'high_error_rate',
          `Taxa de erro alta: ${(errorRate * 100).toFixed(1)}% para ${metric.provider}`
        );
      }
    }

    // Verificar quota
    const quota = this.quotas.get(this.getQuotaKey(metric.provider, metric.userId));
    if (quota) {
      // Assumir quota padrão (pode ser configurável)
      const defaultQuota = this.getDefaultQuota(metric.provider);
      const usage = quota.requests / defaultQuota.requests;
      if (usage > this.alertThresholds.quotaUsage) {
        this.addAlert(
          'quota_warning',
          `Quota ${(usage * 100).toFixed(1)}% utilizada para ${metric.provider}`
        );
      }
    }
  }

  /**
   * Obtém quota padrão por provider
   */
  private getDefaultQuota(provider: AIProvider): { requests: number; tokens: number } {
    const quotas: Record<AIProvider, { requests: number; tokens: number }> = {
      gemini: { requests: 15, tokens: 1000000 }, // 15 RPM, 1M TPM
      openai: { requests: 60, tokens: 500000 },
      claude: { requests: 50, tokens: 1000000 },
      openrouter: { requests: 60, tokens: 500000 },
    };
    return quotas[provider] || { requests: 60, tokens: 100000 };
  }

  /**
   * Adiciona alerta
   */
  private addAlert(type: string, message: string): void {
    this.alerts.push({
      type,
      message,
      timestamp: Date.now(),
    });

    // Manter apenas últimos 100 alertas
    if (this.alerts.length > 100) {
      this.alerts.shift();
    }

    console.log(`[ObservabilityManager] 🚨 ALERTA [${type}]: ${message}`);
  }

  /**
   * Obtém métricas recentes
   */
  private getRecentMetrics(provider?: AIProvider, timeWindowMs: number = 60000): Metric[] {
    const now = Date.now();
    const cutoff = now - timeWindowMs;

    let filtered = this.metrics.filter(m => m.timestamp >= cutoff);
    
    if (provider) {
      filtered = filtered.filter(m => m.provider === provider);
    }

    return filtered;
  }

  /**
   * Obtém estatísticas por endpoint
   */
  getEndpointStats(endpoint: string, timeWindowMs: number = 3600000): {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    errorRate: number;
    totalTokens: number;
    totalCost: number;
  } {
    const metrics = this.getRecentMetrics(undefined, timeWindowMs)
      .filter(m => m.endpoint === endpoint);

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatency: 0,
        errorRate: 0,
        totalTokens: 0,
        totalCost: 0,
      };
    }

    const successful = metrics.filter(m => m.success);
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);

    return {
      totalRequests: metrics.length,
      successRate: successful.length / metrics.length,
      averageLatency: totalDuration / metrics.length,
      errorRate: (metrics.length - successful.length) / metrics.length,
      totalTokens,
      totalCost,
    };
  }

  /**
   * Obtém estatísticas por usuário
   */
  getUserStats(userId: string, timeWindowMs: number = 3600000): {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    totalTokens: number;
    totalCost: number;
    byProvider: Record<AIProvider, number>;
  } {
    const metrics = this.getRecentMetrics(undefined, timeWindowMs)
      .filter(m => m.userId === userId);

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatency: 0,
        totalTokens: 0,
        totalCost: 0,
        byProvider: {} as Record<AIProvider, number>,
      };
    }

    const successful = metrics.filter(m => m.success);
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);

    const byProvider: Record<string, number> = {};
    metrics.forEach(m => {
      byProvider[m.provider] = (byProvider[m.provider] || 0) + 1;
    });

    return {
      totalRequests: metrics.length,
      successRate: successful.length / metrics.length,
      averageLatency: totalDuration / metrics.length,
      totalTokens,
      totalCost,
      byProvider: byProvider as Record<AIProvider, number>,
    };
  }

  /**
   * Obtém estatísticas por provider
   */
  getProviderStats(provider: AIProvider, timeWindowMs: number = 3600000): {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    errorRate: number;
    totalTokens: number;
    totalCost: number;
    recentErrors: Array<{ endpoint: string; errorType: string; timestamp: number }>;
  } {
    const metrics = this.getRecentMetrics(provider, timeWindowMs);

    if (metrics.length === 0) {
      return {
        totalRequests: 0,
        successRate: 0,
        averageLatency: 0,
        errorRate: 0,
        totalTokens: 0,
        totalCost: 0,
        recentErrors: [],
      };
    }

    const successful = metrics.filter(m => m.success);
    const errors = metrics.filter(m => !m.success);
    const totalDuration = metrics.reduce((sum, m) => sum + m.duration, 0);
    const totalTokens = metrics.reduce((sum, m) => sum + (m.tokensUsed || 0), 0);
    const totalCost = metrics.reduce((sum, m) => sum + (m.cost || 0), 0);

    const recentErrors = errors.slice(-10).map(m => ({
      endpoint: m.endpoint,
      errorType: m.errorType || 'unknown',
      timestamp: m.timestamp,
    }));

    return {
      totalRequests: metrics.length,
      successRate: successful.length / metrics.length,
      averageLatency: totalDuration / metrics.length,
      errorRate: errors.length / metrics.length,
      totalTokens,
      totalCost,
      recentErrors,
    };
  }

  /**
   * Obtém alertas recentes
   */
  getRecentAlerts(limit: number = 20): Array<{ type: string; message: string; timestamp: number }> {
    return this.alerts.slice(-limit).reverse();
  }

  /**
   * Obtém quotas atuais
   */
  getCurrentQuotas(): Quota[] {
    return Array.from(this.quotas.values());
  }

  /**
   * Limpa métricas antigas
   */
  cleanOldMetrics(olderThanMs: number = 86400000): void {
    const cutoff = Date.now() - olderThanMs;
    this.metrics = this.metrics.filter(m => m.timestamp >= cutoff);
    console.log(`[ObservabilityManager] 🧹 Limpeza: ${this.metrics.length} métricas mantidas`);
  }
}

export const observabilityManager = new ObservabilityManager();

// Limpar métricas antigas diariamente
setInterval(() => {
  observabilityManager.cleanOldMetrics(7 * 24 * 3600000); // 7 dias
}, 24 * 3600000);


