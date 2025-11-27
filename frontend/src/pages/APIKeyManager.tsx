import { useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  Key,
  Plus,
  Trash2,
  Eye,
  EyeOff,
  RefreshCw,
  Activity,
  CheckCircle,
  XCircle,
  TrendingUp,
  Clock,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import type { AIProvider } from '../shared/types';
import { showNotification } from '../components/Notification';
import { useAppStore, forceRefresh } from '../store/appStore';

// ============================================
// API KEY MANAGER PAGE
// ============================================

const providers: { id: AIProvider; name: string; color: string }[] = [
  { id: 'openai', name: 'OpenAI', color: 'emerald' },
  { id: 'claude', name: 'Claude', color: 'purple' },
  { id: 'gemini', name: 'Gemini', color: 'blue' },
  { id: 'openrouter', name: 'OpenRouter', color: 'orange' },
];

export function APIKeyManager() {
  const { apiKeys, apiKeyStats, apiKeysLoading } = useAppStore();
  const [showKey, setShowKey] = useState<Record<string, boolean>>({});
  const [addingKey, setAddingKey] = useState(false);
  const [newKey, setNewKey] = useState({
    provider: 'openai' as AIProvider,
    key: '',
    label: '',
  });

  const handleAddKey = async () => {
    if (!newKey.key || !newKey.label) {
      showNotification('warning', 'Preencha todos os campos');
      return;
    }

    try {
      const response = await window.api.apiKey.add(
        newKey.provider,
        newKey.key.trim(),
        newKey.label.trim()
      );

      if (response.success) {
        showNotification('success', '✅ Chave adicionada com sucesso!');
        setNewKey({ provider: 'openai', key: '', label: '' });
        setAddingKey(false);
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao adicionar key:', error);
      showNotification('error', 'Erro ao adicionar chave');
    }
  };

  const handleRemoveKey = async (keyId: string) => {
    if (!confirm('Tem certeza que deseja remover esta chave?')) {
      return;
    }

    try {
      const response = await window.api.apiKey.remove(keyId);
      if (response.success) {
        showNotification('success', 'Chave removida');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao remover key:', error);
      showNotification('error', 'Erro ao remover chave');
    }
  };

  const handleToggleActive = async (keyId: string) => {
    try {
      const response = await window.api.apiKey.toggleActive(keyId);
      if (response.success) {
        showNotification('success', 'Status atualizado');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao atualizar key:', error);
      showNotification('error', 'Erro ao atualizar chave');
    }
  };

  const handleClearDuplicates = async () => {
    if (!confirm('Deseja remover chaves duplicadas?')) {
      return;
    }

    try {
      const response = await window.api.apiKey.clearDuplicates();
      if (response.success) {
        showNotification('success', 'Duplicatas removidas');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Erro ao limpar duplicatas:', error);
      showNotification('error', 'Erro ao limpar duplicatas');
    }
  };

  const toggleShowKey = (keyId: string) => {
    setShowKey({ ...showKey, [keyId]: !showKey[keyId] });
  };

  const getHealthColor = (score: number) => {
    if (score >= 80) return 'text-emerald-400';
    if (score >= 60) return 'text-yellow-400';
    return 'text-red-400';
  };

  const getHealthBg = (score: number) => {
    if (score >= 80) return 'bg-emerald-500/20';
    if (score >= 60) return 'bg-yellow-500/20';
    return 'bg-red-500/20';
  };

  const formatDate = (date?: Date) => {
    if (!date) return 'Nunca';
    return new Date(date).toLocaleString('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const maskKey = (key: string) => {
    if (key.length <= 8) return '••••••••';
    return `${key.substring(0, 4)}...${key.substring(key.length - 4)}`;
  };

  if (apiKeysLoading) {
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
            Gerenciador de API Keys
          </h1>
          <p className="text-text-secondary">
            Gerencie todas as chaves API do sistema com rotação inteligente
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
            onClick={() => setAddingKey(!addingKey)}
            className="btn-primary flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Nova Chave
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      {apiKeyStats && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-4">
          <GlassCard className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
                <Key className="w-6 h-6 text-blue-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{apiKeyStats.totalKeys || 0}</p>
                <p className="text-sm text-text-secondary">Total de Chaves</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-emerald-500/10 to-green-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
                <CheckCircle className="w-6 h-6 text-emerald-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{apiKeyStats.activeKeys || 0}</p>
                <p className="text-sm text-text-secondary">Chaves Ativas</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
                <Activity className="w-6 h-6 text-purple-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{apiKeyStats.totalRequests || 0}</p>
                <p className="text-sm text-text-secondary">Requisições</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-red-500/10 to-orange-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-red-500/20 flex items-center justify-center">
                <XCircle className="w-6 h-6 text-red-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">{apiKeyStats.totalErrors || 0}</p>
                <p className="text-sm text-text-secondary">Erros</p>
              </div>
            </div>
          </GlassCard>

          <GlassCard className="bg-gradient-to-br from-yellow-500/10 to-amber-500/10">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-yellow-500/20 flex items-center justify-center">
                <TrendingUp className="w-6 h-6 text-yellow-400" />
              </div>
              <div>
                <p className="text-2xl font-bold text-text-primary">
                  {(apiKeyStats.averageHealthScore || 0).toFixed(0)}%
                </p>
                <p className="text-sm text-text-secondary">Health Médio</p>
              </div>
            </div>
          </GlassCard>
        </div>
      )}

      {/* Add Key Form */}
      {addingKey && (
        <GlassCard className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
          <GlassCardHeader title="Adicionar Nova Chave API" />
          <div className="space-y-4 mt-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Provedor
              </label>
              <select
                value={newKey.provider}
                onChange={(e) => setNewKey({ ...newKey, provider: e.target.value as AIProvider })}
                className="glass-select"
              >
                {providers.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Nome/Label
              </label>
              <input
                type="text"
                value={newKey.label}
                onChange={(e) => setNewKey({ ...newKey, label: e.target.value })}
                placeholder="Ex: Chave Principal, Chave Backup..."
                className="glass-input"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                API Key
              </label>
              <input
                type="password"
                value={newKey.key}
                onChange={(e) => setNewKey({ ...newKey, key: e.target.value })}
                placeholder="Cole a API key aqui"
                className="glass-input"
              />
            </div>

            <div className="flex gap-3">
              <button onClick={handleAddKey} className="btn-primary flex-1">
                <Plus className="w-4 h-4 inline mr-2" />
                Adicionar
              </button>
              <button onClick={() => setAddingKey(false)} className="btn-secondary flex-1">
                Cancelar
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Keys List */}
      <div className="space-y-4">
        {apiKeys.length === 0 ? (
          <GlassCard>
            <div className="text-center py-12">
              <Key className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              <p className="text-text-secondary text-lg">Nenhuma chave API cadastrada</p>
              <p className="text-text-secondary text-sm mt-2">
                Adicione suas primeiras chaves para começar
              </p>
            </div>
          </GlassCard>
        ) : (
          apiKeys.map((key) => {
            const provider = providers.find((p) => p.id === key.provider);
            const isShown = showKey[key.id];

            return (
              <GlassCard key={key.id} className="relative">
                {/* Status Badge */}
                <div className="absolute top-4 right-4">
                  {key.isActive ? (
                    <StatusBadge status="success" label="ATIVA" animate />
                  ) : (
                    <StatusBadge status="error" label="INATIVA" />
                  )}
                </div>

                <div className="space-y-4">
                  {/* Header */}
                  <div className="flex items-start gap-4">
                    <div
                      className={`w-14 h-14 rounded-xl bg-${provider?.color}-500/20 flex items-center justify-center flex-shrink-0`}
                    >
                      <Key className={`w-7 h-7 text-${provider?.color}-400`} />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-3 mb-1">
                        <h3 className="text-xl font-semibold text-text-primary">{key.label}</h3>
                        <span className="text-sm px-3 py-1 rounded-full bg-white/5 text-text-secondary">
                          {provider?.name}
                        </span>
                      </div>
                      <div className="flex items-center gap-2 text-sm text-text-secondary">
                        <span className="font-mono">
                          {isShown ? key.key : maskKey(key.key)}
                        </span>
                        <button
                          onClick={() => toggleShowKey(key.id)}
                          className="text-text-secondary hover:text-text-primary"
                        >
                          {isShown ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Stats Grid */}
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                        <Activity className="w-3 h-3" />
                        Health Score
                      </div>
                      <div className="flex items-center gap-2">
                        <div className={`w-8 h-8 rounded-lg ${getHealthBg(key.healthScore || 0)} flex items-center justify-center`}>
                          <span className={`text-sm font-bold ${getHealthColor(key.healthScore || 0)}`}>
                            {key.healthScore || 0}
                          </span>
                        </div>
                        <span className={`text-xs ${getHealthColor(key.healthScore || 0)}`}>
                          {(key.healthScore || 0) >= 80 ? 'Excelente' : (key.healthScore || 0) >= 60 ? 'Bom' : 'Ruim'}
                        </span>
                      </div>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                        <TrendingUp className="w-3 h-3" />
                        Requisições
                      </div>
                      <p className="text-lg font-bold text-text-primary">{key.requestCount || 0}</p>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                        <AlertTriangle className="w-3 h-3" />
                        Erros
                      </div>
                      <p className="text-lg font-bold text-text-primary">
                        {key.errorCount || 0}
                        {(key.consecutiveErrors || 0) > 0 && (
                          <span className="text-xs text-red-400 ml-1">
                            ({key.consecutiveErrors} seguidos)
                          </span>
                        )}
                      </p>
                    </div>

                    <div className="p-3 bg-white/5 rounded-lg">
                      <div className="flex items-center gap-2 text-text-secondary text-xs mb-1">
                        <Clock className="w-3 h-3" />
                        Último Uso
                      </div>
                      <p className="text-xs text-text-primary">{formatDate(key.lastUsed)}</p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2 border-t border-white/10">
                    <button
                      onClick={() => handleToggleActive(key.id)}
                      className={`btn-secondary flex-1 ${key.isActive ? 'bg-red-500/20 hover:bg-red-500/30' : 'bg-emerald-500/20 hover:bg-emerald-500/30'
                        }`}
                    >
                      {key.isActive ? (
                        <>
                          <XCircle className="w-4 h-4 inline mr-2" />
                          Desativar
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-4 h-4 inline mr-2" />
                          Ativar
                        </>
                      )}
                    </button>
                    <button
                      onClick={() => handleRemoveKey(key.id)}
                      className="btn-secondary bg-red-500/20 hover:bg-red-500/30"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </GlassCard>
            );
          })
        )}
      </div>

      {/* Actions Footer */}
      {apiKeys.length > 0 && (
        <GlassCard className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-semibold text-text-primary mb-1">
                Manutenção
              </h3>
              <p className="text-sm text-text-secondary">
                Remova chaves duplicadas ou não utilizadas
              </p>
            </div>
            <button
              onClick={handleClearDuplicates}
              className="btn-secondary bg-orange-500/20 hover:bg-orange-500/30"
            >
              <Trash2 className="w-4 h-4 inline mr-2" />
              Limpar Duplicatas
            </button>
          </div>
        </GlassCard>
      )}
    </div>
  );
}

