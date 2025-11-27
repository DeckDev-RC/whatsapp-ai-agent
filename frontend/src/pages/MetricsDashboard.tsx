import { useEffect, useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import {
  Activity,
  TrendingUp,
  AlertTriangle,
  Clock,
  CheckCircle,
  interface EndpointStats {
    totalRequests: number;
    successRate: number;
    averageLatency: number;
    errorRate: number;
    totalTokens: number;
    totalCost: number;
  }

interface ProviderStats {
  totalRequests: number;
  successRate: number;
  averageLatency: number;
  errorRate: number;
  totalTokens: number;
  totalCost: number;
  recentErrors: Array<{ endpoint: string; errorType: string; timestamp: number }>;
}

interface QueueStats {
  queueSize: number;
  processing: number;
  concurrency: number;
  rateLimitRPM: number;
  currentRPM: number;
  averageWaitTime: number;
}

interface CacheStats {
  responseCacheSize: number;
  embeddingCacheSize: number;
  responseCacheHits: number;
  embeddingCacheHits: number;
}

export function MetricsDashboard() {
  const [loading, setLoading] = useState(true);
  const [endpointStats, setEndpointStats] = useState<EndpointStats | null>(null);
  const [providerStats, setProviderStats] = useState<Record<AIProvider, ProviderStats>>({} as Record<AIProvider, ProviderStats>);
  const [alerts, setAlerts] = useState<any[]>([]);
  const [quotas, setQuotas] = useState<any[]>([]);
  const [queueStats, setQueueStats] = useState<Record<string, QueueStats>>({});
  const [cacheStats, setCacheStats] = useState<CacheStats | null>(null);
  const [timeWindow, setTimeWindow] = useState<number>(3600000); // 1 hora

  const loadMetrics = async () => {
    setLoading(true);
    try {
      // Carregar todas as métricas em paralelo
      const [
        endpointRes,
        geminiRes,
        openaiRes,
        claudeRes,
        openrouterRes,
        alertsRes,
        quotasRes,
        queueRes,
        cacheRes,
      ] = await Promise.all([
        window.api.metrics.getEndpointStats('generateResponse', timeWindow),
        window.api.metrics.getProviderStats('gemini', timeWindow),
        window.api.metrics.getProviderStats('openai', timeWindow),
        window.api.metrics.getProviderStats('claude', timeWindow),
        window.api.metrics.getProviderStats('openrouter', timeWindow),
        window.api.metrics.getRecentAlerts(20),
        window.api.metrics.getCurrentQuotas(),
        window.api.metrics.getQueueStats(),
        window.api.metrics.getCacheStats(),
      ]);

      if (endpointRes.success) setEndpointStats(endpointRes.data);
      if (geminiRes.success) setProviderStats(prev => ({ ...prev, gemini: geminiRes.data }));
      if (openaiRes.success) setProviderStats(prev => ({ ...prev, openai: openaiRes.data }));
      if (claudeRes.success) setProviderStats(prev => ({ ...prev, claude: claudeRes.data }));
      if (openrouterRes.success) setProviderStats(prev => ({ ...prev, openrouter: openrouterRes.data }));
      if (alertsRes.success) setAlerts(alertsRes.data || []);
      if (quotasRes.success) setQuotas(quotasRes.data || []);
      if (queueRes.success) setQueueStats(queueRes.data);
      if (cacheRes.success) setCacheStats(cacheRes.data);
    } catch (error) {
      console.error('[MetricsDashboard] Erro ao carregar métricas:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMetrics();
    // Atualizar a cada 5 segundos
    const interval = setInterval(loadMetrics, 5000);
    return () => clearInterval(interval);
  }, [timeWindow]);

  const formatNumber = (num: number): string => {
    if (num >= 1000000) return `${(num / 1000000).toFixed(1)}M`;
    if (num >= 1000) return `${(num / 1000).toFixed(1)}K`;
    return num.toFixed(0);
  };

  const formatDuration = (ms: number): string => {
    if (ms >= 1000) return `${(ms / 1000).toFixed(1)}s`;
    return `${Math.round(ms)}ms`;
  };

  const formatTimeAgo = (timestamp: number): string => {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return `${seconds}s atrás`;
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes}m atrás`;
    const hours = Math.floor(minutes / 60);
    return `${hours}h atrás`;
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Métricas em Tempo Real
          </h1>
          <p className="text-text-secondary">
            Monitoramento completo do sistema de IA e performance
          </p>
        </div>
        <div className="flex items-center gap-4">
          <select
            value={timeWindow}
            onChange={(e) => setTimeWindow(Number(e.target.value))}
            className="bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-text-primary"
          >
            <option value={60000}>Última hora</option>
            <option value={3600000}>Últimas 24 horas</option>
            <option value={86400000}>Últimos 7 dias</option>
          </select>
          <button
            onClick={loadMetrics}
            className="btn-secondary flex items-center gap-2"
            disabled={loading}
          >
            <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
            Atualizar
          </button>
        </div>
      </div>

      {/* Overview Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {/* Total Requests */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Total de Requisições</p>
              <p className="text-3xl font-bold text-text-primary">
                {endpointStats ? formatNumber(endpointStats.totalRequests) : '0'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <Activity className="w-6 h-6 text-accent" />
            </div>
          </div>
        </GlassCard>

        {/* Success Rate */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Taxa de Sucesso</p>
              <p className="text-3xl font-bold text-text-primary">
                {endpointStats ? `${(endpointStats.successRate * 100).toFixed(1)}%` : '0%'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center">
              <CheckCircle className="w-6 h-6 text-emerald-400" />
            </div>
          </div>
        </GlassCard>

        {/* Average Latency */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Latência Média</p>
              <p className="text-3xl font-bold text-text-primary">
                {endpointStats ? formatDuration(endpointStats.averageLatency) : '0ms'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Clock className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </GlassCard>

        {/* Cache Hit Rate */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div>
              <p className="text-text-secondary text-sm mb-1">Cache Size</p>
              <p className="text-3xl font-bold text-text-primary">
                {cacheStats ? formatNumber(cacheStats.responseCacheSize + cacheStats.embeddingCacheSize) : '0'}
              </p>
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <HardDrive className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Provider Stats */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {(['gemini', 'openai', 'claude', 'openrouter'] as AIProvider[]).map((provider) => {
          const stats = providerStats[provider];
          if (!stats || stats.totalRequests === 0) return null;

          return (
            <GlassCard key={provider}>
              <GlassCardHeader title={
                <div className="flex items-center gap-2">
                  <Server className="w-5 h-5 text-accent" />
                  <h3 className="font-semibold text-text-primary capitalize">{provider}</h3>
                </div>
              } />
              <div className="mt-4 space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Requisições</span>
                  <span className="font-semibold text-text-primary">{formatNumber(stats.totalRequests)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Taxa de Sucesso</span>
                  <span className="font-semibold text-emerald-400">{(stats.successRate * 100).toFixed(1)}%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Latência Média</span>
                  <span className="font-semibold text-text-primary">{formatDuration(stats.averageLatency)}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-text-secondary text-sm">Taxa de Erro</span>
                  <span className="font-semibold text-red-400">{(stats.errorRate * 100).toFixed(1)}%</span>
                </div>
                {stats.totalTokens > 0 && (
                  <div className="flex justify-between items-center">
                    <span className="text-text-secondary text-sm">Tokens</span>
                    <span className="font-semibold text-text-primary">{formatNumber(stats.totalTokens)}</span>
                  </div>
                )}
                {stats.recentErrors.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-text-secondary text-xs mb-2">Erros Recentes:</p>
                    {stats.recentErrors.slice(0, 3).map((error, idx) => (
                      <div key={idx} className="text-xs text-red-400 mb-1">
                        {error.endpoint}: {error.errorType}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </GlassCard>
          );
        })}
      </div>

      {/* Queue Stats */}
      {Object.keys(queueStats).length > 0 && (
        <GlassCard>
          <GlassCardHeader title={
            <div className="flex items-center gap-2">
              <BarChart3 className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-text-primary">Estatísticas de Fila</h3>
            </div>
          } />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {Object.entries(queueStats).map(([provider, stats]) => (
              <div key={provider} className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-text-primary capitalize mb-3">{provider}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Na Fila</span>
                    <span className="text-text-primary">{stats.queueSize}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Processando</span>
                    <span className="text-text-primary">{stats.processing}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">RPM Atual</span>
                    <span className="text-text-primary">{stats.currentRPM}/{stats.rateLimitRPM}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Tempo Médio</span>
                    <span className="text-text-primary">{formatDuration(stats.averageWaitTime)}</span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Cache Stats */}
      {cacheStats && (
        <GlassCard>
          <GlassCardHeader title={
            <div className="flex items-center gap-2">
              <Database className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-text-primary">Estatísticas de Cache</h3>
            </div>
          } />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-semibold text-text-primary mb-3">Cache de Respostas</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tamanho</span>
                  <span className="text-text-primary">{formatNumber(cacheStats.responseCacheSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Hits</span>
                  <span className="text-text-primary">{formatNumber(cacheStats.responseCacheHits)}</span>
                </div>
              </div>
            </div>
            <div className="bg-white/5 rounded-lg p-4">
              <h4 className="font-semibold text-text-primary mb-3">Cache de Embeddings</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-text-secondary">Tamanho</span>
                  <span className="text-text-primary">{formatNumber(cacheStats.embeddingCacheSize)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-text-secondary">Hits</span>
                  <span className="text-text-primary">{formatNumber(cacheStats.embeddingCacheHits)}</span>
                </div>
              </div>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Alerts */}
      {alerts.length > 0 && (
        <GlassCard>
          <GlassCardHeader title={
            <div className="flex items-center gap-2">
              <AlertTriangle className="w-5 h-5 text-yellow-400" />
              <h3 className="font-semibold text-text-primary">Alertas Recentes</h3>
            </div>
          } />
          <div className="mt-4 space-y-2">
            {alerts.map((alert, idx) => (
              <div
                key={idx}
                className="bg-white/5 rounded-lg p-3 flex items-start justify-between"
              >
                <div className="flex-1">
                  <p className="text-text-primary text-sm font-medium">{alert.message}</p>
                  <p className="text-text-secondary text-xs mt-1">
                    {formatTimeAgo(alert.timestamp)}
                  </p>
                </div>
                <span className="text-xs px-2 py-1 rounded bg-yellow-500/20 text-yellow-400">
                  {alert.type}
                </span>
              </div>
            ))}
          </div>
        </GlassCard>
      )}

      {/* Quotas */}
      {quotas.length > 0 && (
        <GlassCard>
          <GlassCardHeader title={
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-accent" />
              <h3 className="font-semibold text-text-primary">Quotas Atuais</h3>
            </div>
          } />
          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            {quotas.map((quota, idx) => (
              <div key={idx} className="bg-white/5 rounded-lg p-4">
                <h4 className="font-semibold text-text-primary capitalize mb-3">{quota.provider}</h4>
                <div className="space-y-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-text-secondary">Requisições</span>
                    <span className="text-text-primary">{formatNumber(quota.requests)}</span>
                  </div>
                  {quota.tokens > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Tokens</span>
                      <span className="text-text-primary">{formatNumber(quota.tokens)}</span>
                    </div>
                  )}
                  {quota.errors > 0 && (
                    <div className="flex justify-between">
                      <span className="text-text-secondary">Erros</span>
                      <span className="text-red-400">{formatNumber(quota.errors)}</span>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}


