/// <reference types="../../preload/index.d.ts" />
import { useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  Bot,
  Plus,
  Edit2,
  Trash2,
  Check,
  X,
  Loader2,
  RefreshCw,
  Brain,
  MessageSquare,
  Activity,
} from 'lucide-react';
import type { Agent, AIProvider } from '../../shared/types';
import { AI_MODELS } from '../../shared/constants';
import { showNotification } from '../components/Notification';
import { useAppStore, forceRefresh } from '../store/appStore';

// ============================================
// AGENT CONFIGURATION PAGE
// ============================================

const providers: { id: AIProvider; name: string; color: string }[] = [
  { id: 'openai', name: 'OpenAI', color: 'emerald' },
  { id: 'claude', name: 'Claude', color: 'purple' },
  { id: 'gemini', name: 'Gemini', color: 'blue' },
  { id: 'openrouter', name: 'OpenRouter', color: 'orange' },
];

export function AgentConfiguration() {
  const { agents, agentStats, apiKeyStats, agentsLoading } = useAppStore();
  const [editingAgent, setEditingAgent] = useState<Agent | null>(null);
  const [creatingAgent, setCreatingAgent] = useState(false);
  const [formData, setFormData] = useState<{
    name: string;
    description: string;
    provider: AIProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt: string;
  }>({
    name: '',
    description: '',
    provider: 'openai',
    model: '',
    temperature: 0.7,
    maxTokens: 2000,
    systemPrompt: '',
  });

  const handleStartCreate = () => {
    setFormData({
      name: '',
      description: '',
      provider: 'openai',
      model: '',
      temperature: 0.7,
      maxTokens: 2000,
      systemPrompt: '',
    });
    setCreatingAgent(true);
    setEditingAgent(null);
  };

  const handleStartEdit = (agent: Agent) => {
    setFormData({
      name: agent.name,
      description: agent.description || '',
      provider: agent.provider,
      model: agent.model,
      temperature: agent.temperature,
      maxTokens: agent.maxTokens,
      systemPrompt: agent.systemPrompt || '',
    });
    setEditingAgent(agent);
    setCreatingAgent(false);
  };

  const handleCancelForm = () => {
    setCreatingAgent(false);
    setEditingAgent(null);
  };

  const handleSave = async () => {
    if (!formData.name || !formData.model) {
      showNotification('warning', 'Preencha nome e modelo');
      return;
    }

    try {
      if (editingAgent) {
        // Atualizar agente existente
        const response = await window.api.agent.update(editingAgent.id, formData);
        if (response.success) {
          showNotification('success', '✅ Agente atualizado!');
          handleCancelForm();
          forceRefresh();
        } else {
          showNotification('error', `Erro: ${response.error}`);
        }
      } else {
        // Criar novo agente
        const response = await window.api.agent.create(formData);
        if (response.success) {
          showNotification('success', '✅ Agente criado!');
          handleCancelForm();
          forceRefresh();
        } else {
          showNotification('error', `Erro: ${response.error}`);
        }
      }
    } catch (error) {
      console.error('Erro ao salvar agente:', error);
      showNotification('error', 'Erro ao salvar agente');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja deletar este agente?')) {
      return;
    }

    try {
      const response = await window.api.agent.delete(id);
      if (response.success) {
        showNotification('success', 'Agente deletado');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Erro ao deletar agente:', error);
      showNotification('error', 'Erro ao deletar agente');
    }
  };

  const handleToggleActive = async (id: string) => {
    try {
      const response = await window.api.agent.toggleActive(id);
      if (response.success) {
        showNotification('success', 'Status atualizado');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Erro ao alternar status:', error);
      showNotification('error', 'Erro ao atualizar status');
    }
  };

  const getProviderColor = (providerId: AIProvider) => {
    return providers.find((p) => p.id === providerId)?.color || 'gray';
  };

  const getProviderName = (providerId: AIProvider) => {
    return providers.find((p) => p.id === providerId)?.name || providerId;
  };

  const getAvailableKeysForProvider = (providerId: AIProvider): number => {
    return apiKeyStats?.keysByProvider?.[providerId] || 0;
  };

  if (agentsLoading) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Configuração de Agentes
          </h1>
          <p className="text-text-secondary">
            Configure agentes inteligentes que usam suas API keys e respondem conversas
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={forceRefresh}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
          <button
            onClick={handleStartCreate}
            className="btn-primary flex items-center gap-2"
            disabled={creatingAgent || !!editingAgent}
          >
            <Plus className="w-5 h-5" />
            Novo Agente
          </button>
        </div>
      </div>

      {/* Info Banner */}
      <GlassCard className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Bot className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">
              Como funcionam os Agentes?
            </h3>
            <p className="text-sm text-text-secondary">
              Agentes são assistentes de IA que você configura uma vez e atribui a conversas do WhatsApp. 
              Eles usam automaticamente as API keys que você gerenciou em "API Keys", com rotação inteligente e fallback. 
              Cada agente pode ter seu próprio modelo, temperature e system prompt personalizado.
            </p>
          </div>
        </div>
      </GlassCard>

      {/* Stats */}
      {agentStats && apiKeyStats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <GlassCard className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Bot className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{agentStats.totalAgents || 0}</p>
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
                <p className="text-2xl font-bold text-text-primary">{agentStats.activeAgents || 0}</p>
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
                <p className="text-2xl font-bold text-text-primary">{agentStats.totalAssignments || 0}</p>
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
                <p className="text-2xl font-bold text-text-primary">{apiKeyStats.activeKeys || 0}</p>
                <p className="text-sm text-text-secondary">API Keys Disponíveis</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Create/Edit Form */}
      {(creatingAgent || editingAgent) && (
        <GlassCard className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
          <GlassCardHeader
            title={editingAgent ? 'Editar Agente' : 'Criar Novo Agente'}
          />

          <div className="space-y-4 mt-6">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Nome do Agente *
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  placeholder="Ex: Atendente Vendas"
                  className="glass-input"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Provedor *
                </label>
                <select
                  value={formData.provider}
                  onChange={(e) => setFormData({ ...formData, provider: e.target.value as AIProvider, model: '' })}
                  className="glass-select"
                >
                  {providers.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.name} ({getAvailableKeysForProvider(p.id)} keys)
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Descrição
              </label>
              <input
                type="text"
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="Descrição opcional do agente"
                className="glass-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Modelo *
              </label>
              <select
                value={formData.model}
                onChange={(e) => setFormData({ ...formData, model: e.target.value })}
                className="glass-select"
              >
                <option value="">Selecione um modelo</option>
                {AI_MODELS[formData.provider].map((model) => (
                  <option key={model} value={model}>
                    {model}
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Temperature: <span className="text-accent">{formData.temperature.toFixed(1)}</span>
                </label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={formData.temperature}
                  onChange={(e) => setFormData({ ...formData, temperature: parseFloat(e.target.value) })}
                  className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent"
                />
                <div className="flex justify-between text-xs text-text-secondary mt-1">
                  <span>Preciso</span>
                  <span>Criativo</span>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Max Tokens
                </label>
                <input
                  type="number"
                  value={formData.maxTokens}
                  onChange={(e) => setFormData({ ...formData, maxTokens: parseInt(e.target.value) })}
                  min="100"
                  max="8000"
                  step="100"
                  className="glass-input"
                />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                System Prompt (Opcional)
              </label>
              <textarea
                value={formData.systemPrompt}
                onChange={(e) => setFormData({ ...formData, systemPrompt: e.target.value })}
                placeholder="Defina como o agente deve se comportar..."
                rows={4}
                className="glass-input resize-none"
              />
            </div>

            <div className="flex gap-3 pt-4 border-t border-white/10">
              <button onClick={handleSave} className="btn-primary flex-1">
                <Check className="w-4 h-4 inline mr-2" />
                {editingAgent ? 'Atualizar' : 'Criar'} Agente
              </button>
              <button onClick={handleCancelForm} className="btn-secondary flex-1">
                <X className="w-4 h-4 inline mr-2" />
                Cancelar
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Agents List */}
      <div className="space-y-4">
        {agents.length === 0 ? (
          <GlassCard>
            <div className="text-center py-12">
              <Bot className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary text-lg">Nenhum agente configurado</p>
              <p className="text-text-secondary text-sm mt-2">
                Crie seu primeiro agente para começar
              </p>
            </div>
          </GlassCard>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {agents.map((agent) => {
              const providerColor = getProviderColor(agent.provider);
              const providerName = getProviderName(agent.provider);

              return (
                <GlassCard key={agent.id} className="relative">
                  {/* Status Badge */}
                  <div className="absolute top-4 right-4">
                    {agent.isActive ? (
                      <StatusBadge status="success" label="ATIVO" animate />
                    ) : (
                      <StatusBadge status="error" label="INATIVO" />
                    )}
                  </div>

                  <div className="space-y-4">
                    {/* Header */}
                    <div className="flex items-start gap-4">
                      <div
                        className={`w-14 h-14 rounded-xl bg-${providerColor}-500/20 flex items-center justify-center flex-shrink-0`}
                      >
                        <Bot className={`w-7 h-7 text-${providerColor}-400`} />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-xl font-semibold text-text-primary mb-1">
                          {agent.name}
                        </h3>
                        {agent.description && (
                          <p className="text-sm text-text-secondary">{agent.description}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-text-secondary">
                            {providerName}
                          </span>
                          <span className="text-xs px-2 py-1 rounded-full bg-white/5 text-text-secondary">
                            {agent.model}
                          </span>
                        </div>
                      </div>
                    </div>

                    {/* Config */}
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-text-secondary mb-1">Temperature</div>
                        <div className="text-lg font-bold text-text-primary">
                          {agent.temperature.toFixed(1)}
                        </div>
                      </div>
                      <div className="p-3 bg-white/5 rounded-lg">
                        <div className="text-xs text-text-secondary mb-1">Max Tokens</div>
                        <div className="text-lg font-bold text-text-primary">
                          {agent.maxTokens}
                        </div>
                      </div>
                    </div>

                    {/* Actions */}
                    <div className="flex gap-2 pt-2 border-t border-white/10">
                      <button
                        onClick={() => handleToggleActive(agent.id)}
                        className={`btn-secondary flex-1 ${
                          agent.isActive
                            ? 'bg-orange-500/20 hover:bg-orange-500/30'
                            : 'bg-emerald-500/20 hover:bg-emerald-500/30'
                        }`}
                      >
                        {agent.isActive ? 'Desativar' : 'Ativar'}
                      </button>
                      <button
                        onClick={() => handleStartEdit(agent)}
                        className="btn-secondary"
                        disabled={creatingAgent || !!editingAgent}
                      >
                        <Edit2 className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDelete(agent.id)}
                        className="btn-secondary bg-red-500/20 hover:bg-red-500/30"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </GlassCard>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

