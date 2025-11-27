import { useEffect, useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { Activity, User, Bot, Loader2, Filter } from 'lucide-react';
import type { Conversation, Tenant, TypingIndicator } from '../shared/types';

// ============================================
// LOGS & MONITORING PAGE
// ============================================

export function LogsMonitoring() {
  const [conversations, setConversations] = useState<Conversation[]>([]);
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [selectedTenant, setSelectedTenant] = useState<string>('all');
  const [loading, setLoading] = useState(true);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [typingIndicators] = useState<Map<string, TypingIndicator>>(new Map());

  useEffect(() => {
    loadData();

    if (autoRefresh) {
      const interval = setInterval(loadData, 5000);
      return () => clearInterval(interval);
    }

    // Retorna função vazia quando autoRefresh é false para garantir que todos os caminhos retornem um valor
    return () => { };
  }, [selectedTenant, autoRefresh]);

  const loadData = async () => {
    try {
      const tenantsRes = await window.api.tenant.getAll();
      if (tenantsRes.success && tenantsRes.data) {
        setTenants(tenantsRes.data);
      }

      let conversationsRes;
      if (selectedTenant === 'all') {
        conversationsRes = await window.api.conversation.getAll();
      } else {
        conversationsRes = await window.api.conversation.getByTenant(selectedTenant);
      }

      if (conversationsRes.success && conversationsRes.data) {
        setConversations(conversationsRes.data);
      }
    } catch (error) {
      console.error('Error loading logs:', error);
    } finally {
      setLoading(false);
    }
  };

  const getTenantName = (tenantId: string) => {
    return tenants.find((t) => t.id === tenantId)?.name || 'Desconhecido';
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    }).format(date);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div>
        <h1 className="text-4xl font-bold text-text-primary mb-2">
          Logs & Monitoramento
        </h1>
        <p className="text-text-secondary">
          Acompanhe conversas em tempo real
        </p>
      </div>

      {/* Filters */}
      <GlassCard>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Filter className="w-5 h-5 text-text-secondary" />
            <select
              value={selectedTenant}
              onChange={(e) => setSelectedTenant(e.target.value)}
              className="glass-select w-64"
            >
              <option value="all">Todas as empresas</option>
              {tenants.map((tenant) => (
                <option key={tenant.id} value={tenant.id}>
                  {tenant.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <label className="flex items-center gap-2 text-sm text-text-secondary">
              <input
                type="checkbox"
                checked={autoRefresh}
                onChange={(e) => setAutoRefresh(e.target.checked)}
                className="w-4 h-4"
              />
              Auto-refresh (5s)
            </label>

            <button
              onClick={loadData}
              className="btn-secondary flex items-center gap-2"
            >
              <Activity className="w-4 h-4" />
              Atualizar
            </button>
          </div>
        </div>
      </GlassCard>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <GlassCard>
          <div className="flex items-center gap-3">
            <Activity className="w-8 h-8 text-accent" />
            <div>
              <p className="text-sm text-text-secondary">Total de Mensagens</p>
              <p className="text-2xl font-bold text-text-primary">{conversations.length}</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <User className="w-8 h-8 text-blue-400" />
            <div>
              <p className="text-sm text-text-secondary">Mensagens de Clientes</p>
              <p className="text-2xl font-bold text-text-primary">
                {conversations.filter((c) => c.role === 'user').length}
              </p>
            </div>
          </div>
        </GlassCard>

        <GlassCard>
          <div className="flex items-center gap-3">
            <Bot className="w-8 h-8 text-purple-400" />
            <div>
              <p className="text-sm text-text-secondary">Respostas da IA</p>
              <p className="text-2xl font-bold text-text-primary">
                {conversations.filter((c) => c.role === 'assistant').length}
              </p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Conversations */}
      <GlassCard>
        <GlassCardHeader title="Conversas Recentes" />

        {conversations.length === 0 ? (
          <div className="text-center py-12">
            <Activity className="w-16 h-16 text-text-secondary mx-auto mb-4" />
            <p className="text-text-secondary">Nenhuma conversa encontrada</p>
          </div>
        ) : (
          <div className="space-y-4 max-h-[600px] overflow-y-auto pr-2">
            {conversations.map((conv) => (
              <div
                key={conv.id}
                className={`p-4 rounded-xl border transition-all ${conv.role === 'user'
                  ? 'bg-blue-500/5 border-blue-500/20'
                  : 'bg-purple-500/5 border-purple-500/20'
                  }`}
              >
                <div className="flex items-start gap-3">
                  {/* Icon */}
                  <div
                    className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${conv.role === 'user' ? 'bg-blue-500/10' : 'bg-purple-500/10'
                      }`}
                  >
                    {conv.role === 'user' ? (
                      <User className="w-5 h-5 text-blue-400" />
                    ) : (
                      <Bot className="w-5 h-5 text-purple-400" />
                    )}
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span
                        className={`text-sm font-semibold ${conv.role === 'user' ? 'text-blue-400' : 'text-purple-400'
                          }`}
                      >
                        {conv.role === 'user' ? 'Cliente' : 'IA'}
                      </span>
                      <span className="text-xs text-text-secondary">
                        +{conv.phone_number}
                      </span>
                      <span className="text-xs text-text-secondary">•</span>
                      <span className="text-xs text-text-secondary">
                        {getTenantName(conv.tenant_id)}
                      </span>
                    </div>

                    <p className="text-sm text-text-primary whitespace-pre-wrap">
                      {conv.message}
                    </p>

                    {/* Indicador de digitação */}
                    {(() => {
                      const typingKey = `${conv.phone_number}_${conv.phone_number}`;
                      const isTyping = typingIndicators.has(typingKey);
                      return isTyping ? (
                        <div className="flex items-center gap-2 mt-2 text-xs text-accent">
                          <div className="flex gap-1">
                            <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></span>
                            <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></span>
                            <span className="w-1 h-1 bg-accent rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></span>
                          </div>
                          <span>digitando...</span>
                        </div>
                      ) : null;
                    })()}

                    <p className="text-xs text-text-secondary mt-2">
                      {formatDate(conv.created_at)}
                    </p>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </GlassCard>
    </div>
  );
}

