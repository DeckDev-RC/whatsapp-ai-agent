import { useEffect } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { MessageSquare, Brain, Database, Building2, TrendingUp, Bot, Activity, RefreshCw } from 'lucide-react';
import { useAppStore, forceRefresh } from '../store/appStore';

// ============================================
// DASHBOARD PAGE
// ============================================

export function Dashboard() {
  const { stats, whatsapp, supabase, activeAIProvider, agentStats, agentsLoading, loadAll } = useAppStore();

  useEffect(() => {
    loadAll();
  }, [loadAll]);

  // Debug: Log quando agentStats mudar
  useEffect(() => {
    console.log('[Dashboard] agentStats atualizado:', agentStats);
  }, [agentStats]);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
      <div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          Dashboard
        </h1>
        <p className="text-text-secondary">
          Visão geral do sistema WhatsApp AI Agent
        </p>
        </div>
        <button
          onClick={() => {
            forceRefresh();
          }}
          className="btn-secondary flex items-center gap-2"
          title="Atualizar"
          disabled={agentsLoading}
        >
          <RefreshCw className={`w-5 h-5 ${agentsLoading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {/* WhatsApp Status */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <MessageSquare className="w-5 h-5 text-accent" />
                <h3 className="font-semibold text-text-primary">WhatsApp</h3>
              </div>
              <StatusBadge
                status={whatsapp?.isConnected ? 'success' : 'error'}
                animate={whatsapp?.isConnected}
              />
              {whatsapp?.statusMessage && (
                <p className="text-xs text-text-secondary mt-2">
                  {whatsapp.statusMessage}
                </p>
              )}
              {whatsapp?.phoneNumber && (
                <p className="text-xs text-text-secondary mt-1 font-mono">
                  +{whatsapp.phoneNumber}
                </p>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
              <MessageSquare className="w-6 h-6 text-accent" />
            </div>
          </div>
        </GlassCard>

        {/* Database Status */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Database className="w-5 h-5 text-blue-400" />
                <h3 className="font-semibold text-text-primary">Supabase</h3>
              </div>
              <StatusBadge
                status={supabase?.isConnected ? 'success' : 'error'}
              />
              {supabase && (
                <p className="text-xs text-text-secondary mt-2">
                  {supabase.isConnected ? 'Conectado' : 'Não configurado'}
                </p>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-blue-500/10 flex items-center justify-center">
              <Database className="w-6 h-6 text-blue-400" />
            </div>
          </div>
        </GlassCard>

        {/* Agentes Ativos */}
        <GlassCard>
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-3">
                <Bot className="w-5 h-5 text-purple-400" />
                <h3 className="font-semibold text-text-primary">Agentes Ativos</h3>
              </div>
              {agentStats && agentStats.activeAgents > 0 ? (
                <>
                  <StatusBadge status="success" label="Funcionando" animate />
                  <p className="text-xs text-text-secondary mt-2">
                    {agentStats.activeAgents} agente{agentStats.activeAgents !== 1 ? 's' : ''} ativo{agentStats.activeAgents !== 1 ? 's' : ''}
                  </p>
                  {activeAIProvider && (
                    <p className="text-xs text-text-secondary mt-1">
                      Provider: {activeAIProvider === 'openai' && 'OpenAI'}
                    {activeAIProvider === 'claude' && 'Anthropic Claude'}
                    {activeAIProvider === 'gemini' && 'Google Gemini'}
                    {activeAIProvider === 'openrouter' && 'OpenRouter'}
                  </p>
                  )}
                </>
              ) : (
                <>
                  <StatusBadge status="error" label="Nenhum" />
                  <p className="text-xs text-text-secondary mt-2">
                    Nenhum agente ativo
                  </p>
                  {activeAIProvider && (
                    <p className="text-xs text-text-secondary mt-1">
                      Provider: {activeAIProvider === 'openai' && 'OpenAI'}
                      {activeAIProvider === 'claude' && 'Anthropic Claude'}
                      {activeAIProvider === 'gemini' && 'Google Gemini'}
                      {activeAIProvider === 'openrouter' && 'OpenRouter'}
                  </p>
                  )}
                </>
              )}
            </div>
            <div className="w-12 h-12 rounded-xl bg-purple-500/10 flex items-center justify-center">
              <Bot className="w-6 h-6 text-purple-400" />
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Messages Count */}
        <GlassCard>
          <GlassCardHeader
            title="Mensagens"
            description="Total de mensagens processadas"
          />
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold text-accent">
              {stats?.messagesCount || 0}
            </div>
            <div className="flex items-center gap-1 text-emerald-400 mb-2">
              <TrendingUp className="w-4 h-4" />
              <span className="text-sm font-medium">Hoje</span>
            </div>
          </div>
        </GlassCard>

        {/* Active Tenants */}
        <GlassCard>
          <GlassCardHeader
            title="Empresas Ativas"
            description="Empresas cadastradas no sistema"
          />
          <div className="flex items-end gap-4">
            <div className="text-5xl font-bold text-blue-400">
              {stats?.activeTenants || 0}
            </div>
            <div className="flex items-center gap-1 text-text-secondary mb-2">
              <Building2 className="w-4 h-4" />
              <span className="text-sm font-medium">Tenants</span>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Agents Stats Grid */}
      <div>
        <GlassCardHeader
          title="Estatísticas de Agentes"
          description="Visão geral dos agentes configurados no sistema"
        />
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mt-4">
          <GlassCard className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{agentStats?.totalAgents || 0}</p>
                <p className="text-sm text-text-secondary">Total de Agentes</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-emerald-500/10 to-green-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{agentStats?.activeAgents || 0}</p>
                <p className="text-sm text-text-secondary">Agentes Ativos</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <MessageSquare className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{agentStats?.totalAssignments || 0}</p>
                <p className="text-sm text-text-secondary">Conversas Atribuídas</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-orange-500/10 to-red-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
                <Brain className="w-6 h-6 text-orange-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {agentStats?.agentsByProvider ? Object.keys(agentStats.agentsByProvider).length : 0}
                </p>
                <p className="text-sm text-text-secondary">Providers</p>
              </div>
            </div>
          </GlassCard>
        </div>
      </div>

      {/* Quick Actions */}
      <GlassCard>
        <GlassCardHeader
          title="Ações Rápidas"
          description="Acessos rápidos às principais funcionalidades"
        />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button
            onClick={() => window.location.hash = '/whatsapp'}
            className="glass-card-hover p-4 text-left"
          >
            <MessageSquare className="w-6 h-6 text-accent mb-2" />
            <h4 className="font-semibold text-text-primary mb-1">Conectar WhatsApp</h4>
            <p className="text-sm text-text-secondary">
              Configure sua conexão WhatsApp
            </p>
          </button>

          <button
            onClick={() => window.location.hash = '/ai'}
            className="glass-card-hover p-4 text-left"
          >
            <Brain className="w-6 h-6 text-purple-400 mb-2" />
            <h4 className="font-semibold text-text-primary mb-1">Configurar IA</h4>
            <p className="text-sm text-text-secondary">
              Configure modelos de IA
            </p>
          </button>

          <button
            onClick={() => window.location.hash = '/companies'}
            className="glass-card-hover p-4 text-left"
          >
            <Building2 className="w-6 h-6 text-blue-400 mb-2" />
            <h4 className="font-semibold text-text-primary mb-1">Gerenciar Empresas</h4>
            <p className="text-sm text-text-secondary">
              Adicione e gerencie empresas
            </p>
          </button>
        </div>
      </GlassCard>
    </div>
  );
}

