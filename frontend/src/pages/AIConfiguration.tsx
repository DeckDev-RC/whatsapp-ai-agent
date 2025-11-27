/// <reference types="../../preload/index.d.ts" />
import { useEffect, useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { Brain, Check, Loader2, RefreshCw, Key, Eye, EyeOff, CheckCircle, Circle, ArrowRight } from 'lucide-react';
import type { AIProvider, AIConfig } from '../../shared/types';
import { AI_MODELS, DEFAULT_AI_CONFIG } from '../../shared/constants';
import { useAppStore, forceRefresh } from '../store/appStore';
import { showNotification } from '../components/Notification';

// ============================================
// AI CONFIGURATION PAGE - SIMPLIFICADO
// ============================================

const providers: { id: AIProvider; name: string; description: string }[] = [
  { id: 'openai', name: 'OpenAI', description: 'GPT-4, GPT-3.5 e modelos da OpenAI' },
  { id: 'claude', name: 'Anthropic Claude', description: 'Claude 3 Opus, Sonnet e Haiku' },
  { id: 'gemini', name: 'Google Gemini', description: 'Gemini 2.0/2.5 Flash (testados e funcionando) - Suporta API gratuita' },
  { id: 'openrouter', name: 'OpenRouter', description: 'Acesso a múltiplos modelos' },
];

export function AIConfiguration() {
  const { aiConfigs, activeAIProvider, loadAIConfigs, setActiveAIProvider } = useAppStore();
  const [localConfigs, setLocalConfigs] = useState<Record<AIProvider, AIConfig>>({} as Record<AIProvider, AIConfig>);
  const [testing, setTesting] = useState<Record<string, boolean>>({});
  const [saving, setSaving] = useState<Record<string, boolean>>({});
  const [activating, setActivating] = useState<Record<string, boolean>>({});
  const [showApiKeys, setShowApiKeys] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadAIConfigs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const initialized: Record<AIProvider, AIConfig> = {} as Record<AIProvider, AIConfig>;
    providers.forEach(provider => {
      const savedConfig = aiConfigs?.[provider.id];
      
      initialized[provider.id] = {
        ...DEFAULT_AI_CONFIG,
        provider: provider.id,
        apiKey: savedConfig?.apiKey || '',
        model: savedConfig?.model || '',
        temperature: savedConfig?.temperature ?? DEFAULT_AI_CONFIG.temperature,
        maxTokens: savedConfig?.maxTokens ?? DEFAULT_AI_CONFIG.maxTokens,
        isActive: savedConfig?.isActive || false,
        configMode: 'manual',
        useKeyRotation: false,
      } as AIConfig;
    });
    setLocalConfigs(initialized);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [aiConfigs]);

  const handleTestConnection = async (provider: AIProvider) => {
    const config = localConfigs[provider];
    if (!config?.apiKey) {
      showNotification('warning', 'Configure a API Key primeiro');
      return;
    }

    const apiKey = config.apiKey.trim();
    if (!apiKey || apiKey.length < 10) {
      showNotification('error', 'API key inválida. Verifique se copiou a chave completa.');
      return;
    }

    setTesting({ ...testing, [provider]: true });
    try {
      const response = await window.api.ai.testConnection(provider, config);
      if (response.success && response.data) {
        showNotification('success', '✅ Conexão bem-sucedida! Agora salve a configuração.');
      } else {
        let errorMessage = response.error || 'Falha na conexão';
        
        if (errorMessage.includes('401') || errorMessage.includes('invalid_api_key') || errorMessage.includes('Incorrect API key')) {
          errorMessage = 'API key incorreta. Verifique se copiou a chave completa.';
        } else if (errorMessage.includes('403')) {
          errorMessage = 'Acesso negado. Verifique as permissões da API key.';
        } else if (errorMessage.includes('429') || errorMessage.includes('rate limit')) {
          errorMessage = 'Limite de requisições excedido. Aguarde e tente novamente.';
        }

        showNotification('error', errorMessage);
      }
    } catch (error) {
      console.error('Test connection error:', error);
      showNotification('error', 'Erro ao testar conexão');
    } finally {
      setTesting({ ...testing, [provider]: false });
    }
  };

  const handleSave = async (provider: AIProvider) => {
    const config = localConfigs[provider];

    if (!config?.apiKey || !config?.model) {
      showNotification('warning', 'Preencha API Key e Modelo antes de salvar');
      return;
    }

    const cleanConfig: AIConfig = {
      ...config,
      apiKey: config.apiKey.trim(),
      isActive: false, // Ao salvar, não ativa automaticamente
      configMode: 'manual',
      useKeyRotation: false,
    };

    setSaving({ ...saving, [provider]: true });
    try {
      const response = await window.api.ai.saveConfig(provider, cleanConfig);
      if (response.success) {
        forceRefresh();
        showNotification('success', `✅ ${providers.find(p => p.id === provider)?.name} salvo! Agora você pode ativar.`);
      } else {
        showNotification('error', `Erro ao salvar: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('Save config error:', error);
      showNotification('error', 'Erro ao salvar configuração');
    } finally {
      setSaving({ ...saving, [provider]: false });
    }
  };

  const handleActivate = async (provider: AIProvider) => {
    console.log(`[AIConfiguration] handleActivate chamado para ${provider}`);
    const savedConfig = aiConfigs?.[provider];
    
    console.log(`[AIConfiguration] Config salva:`, {
      hasApiKey: !!savedConfig?.apiKey,
      hasModel: !!savedConfig?.model,
      savedConfig
    });
    
    if (!savedConfig?.apiKey || !savedConfig?.model) {
      console.warn(`[AIConfiguration] Config incompleta, abortando ativação`);
      showNotification('warning', 'Salve a configuração primeiro antes de ativar');
      return;
    }

    setActivating({ ...activating, [provider]: true });
    try {
      console.log(`[AIConfiguration] Chamando window.api.ai.setActive(${provider})`);
      const response = await window.api.ai.setActive(provider);
      console.log(`[AIConfiguration] Resposta do setActive:`, response);
      
      if (response.success) {
        setActiveAIProvider(provider);
        forceRefresh();
        showNotification('success', `🎉 ${providers.find(p => p.id === provider)?.name} está ATIVO e pronto para usar!`);
      } else {
        console.error(`[AIConfiguration] Falha ao ativar:`, response.error);
        showNotification('error', `Erro ao ativar: ${response.error || 'Erro desconhecido'}`);
      }
    } catch (error) {
      console.error('[AIConfiguration] Erro na ativação:', error);
      showNotification('error', 'Erro ao ativar provider');
    } finally {
      setActivating({ ...activating, [provider]: false });
    }
  };

  const updateConfig = (provider: AIProvider, field: keyof AIConfig, value: string | number | boolean) => {
    setLocalConfigs({
      ...localConfigs,
      [provider]: {
        ...DEFAULT_AI_CONFIG,
        ...localConfigs[provider],
        provider,
        [field]: value,
      } as AIConfig,
    });
  };

  const toggleShowApiKey = (provider: AIProvider) => {
    setShowApiKeys({
      ...showApiKeys,
      [provider]: !showApiKeys[provider],
    });
  };

  const handleRefresh = () => {
    forceRefresh();
    showNotification('info', 'Configurações atualizadas');
  };

  // Helper para determinar o estado do provider
  const getProviderState = (provider: AIProvider) => {
    const savedConfig = aiConfigs?.[provider];
    const localConfig = localConfigs[provider];
    const isActive = activeAIProvider === provider;
    const isSaved = !!(savedConfig?.apiKey && savedConfig?.model);
    const hasLocalChanges = !!(localConfig?.apiKey || localConfig?.model);

    return {
      isActive,
      isSaved,
      hasLocalChanges,
      isConfigured: isSaved,
    };
  };

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Configuração de IA
          </h1>
          <p className="text-text-secondary">
            Configure e ative um provedor de IA para o agente
          </p>
        </div>
        <button
          onClick={handleRefresh}
          className="btn-secondary flex items-center gap-2"
          title="Atualizar configurações"
        >
          <RefreshCw className="w-5 h-5" />
          Atualizar
        </button>
      </div>

      {/* Info Card - Fluxo de Configuração */}
      <GlassCard className="bg-gradient-to-r from-blue-500/10 to-purple-500/10 border-blue-500/30">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center flex-shrink-0">
            <Brain className="w-6 h-6 text-blue-400" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-blue-400 mb-2">
              Como configurar um provedor de IA
            </h3>
            <div className="flex items-center gap-3 text-sm text-text-secondary flex-wrap">
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">1</div>
                <span>Configure API Key e Modelo</span>
              </div>
              <ArrowRight className="w-4 h-4" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">2</div>
                <span>Teste a conexão</span>
              </div>
              <ArrowRight className="w-4 h-4" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 font-bold text-xs">3</div>
                <span>Salve</span>
              </div>
              <ArrowRight className="w-4 h-4" />
              <div className="flex items-center gap-2">
                <div className="w-6 h-6 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 font-bold text-xs">4</div>
                <span className="text-emerald-400 font-medium">Ative</span>
              </div>
            </div>
          </div>
        </div>
      </GlassCard>

      {/* Providers Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {providers.map((provider) => {
          const config = localConfigs[provider.id] || {
            ...DEFAULT_AI_CONFIG,
            provider: provider.id,
            apiKey: '',
            model: '',
          } as AIConfig;
          const state = getProviderState(provider.id);
          const isTesting = testing[provider.id];
          const isSaving = saving[provider.id];
          const isActivating = activating[provider.id];
          const showApiKey = showApiKeys[provider.id];

          return (
            <GlassCard key={provider.id} className="relative">
              {/* Status Badge */}
              <div className="absolute top-4 right-4">
                {state.isActive && (
                  <StatusBadge status="success" label="ATIVO" animate />
                )}
                {!state.isActive && state.isSaved && (
                  <StatusBadge status="warning" label="Salvo" />
                )}
              </div>

              <GlassCardHeader
                title={
                  <div className="flex items-center gap-3">
                    <div className={`w-12 h-12 rounded-xl flex items-center justify-center ${
                      state.isActive 
                        ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50' 
                        : state.isSaved
                        ? 'bg-blue-500/20'
                        : 'bg-white/5'
                    }`}>
                      <Brain className={`w-6 h-6 ${
                        state.isActive 
                          ? 'text-emerald-400' 
                          : state.isSaved
                          ? 'text-blue-400'
                          : 'text-text-secondary'
                      }`} />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-text-primary">{provider.name}</h3>
                      <p className="text-xs text-text-secondary mt-0.5">{provider.description}</p>
                    </div>
                  </div>
                }
              />

              <div className="space-y-4 mt-6">
                {/* Progress Indicator */}
                <div className="grid grid-cols-4 gap-2">
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      config.apiKey && config.model ? 'bg-emerald-500/20' : 'bg-white/5'
                    }`}>
                      {config.apiKey && config.model ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">Configurar</span>
                  </div>
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      isTesting ? 'bg-blue-500/20' : 'bg-white/5'
                    }`}>
                      {isTesting ? (
                        <Loader2 className="w-5 h-5 text-blue-400 animate-spin" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">Testar</span>
                  </div>
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      state.isSaved ? 'bg-emerald-500/20' : 'bg-white/5'
                    }`}>
                      {state.isSaved ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">Salvo</span>
                  </div>
                  <div className="text-center">
                    <div className={`w-10 h-10 mx-auto rounded-full flex items-center justify-center mb-1 ${
                      state.isActive ? 'bg-emerald-500/20 ring-2 ring-emerald-500/50' : 'bg-white/5'
                    }`}>
                      {state.isActive ? (
                        <CheckCircle className="w-5 h-5 text-emerald-400" />
                      ) : (
                        <Circle className="w-5 h-5 text-text-secondary" />
                      )}
                    </div>
                    <span className="text-xs text-text-secondary">Ativo</span>
                  </div>
                </div>

                {/* Status Message */}
                {state.isActive && (
                  <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl">
                    <p className="text-sm text-emerald-400 font-medium flex items-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Este provedor está ATIVO e sendo usado pelo agente
                    </p>
                  </div>
                )}

                {!state.isActive && state.isSaved && (
                  <div className="p-3 bg-blue-500/10 border border-blue-500/30 rounded-xl">
                    <p className="text-sm text-blue-400 flex items-center gap-2">
                      <Key className="w-4 h-4" />
                      Configuração salva. Clique em "Ativar" para usar este provedor.
                    </p>
                  </div>
                )}

                {/* API Key */}
                <div className="space-y-2">
                  <label className="block text-sm font-medium text-text-primary flex items-center gap-2">
                    <Key className="w-4 h-4" />
                    API Key
                    {state.isSaved && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30">
                        Salva
                      </span>
                    )}
                  </label>
                  <div className="relative">
                    <input
                      type={showApiKey ? 'text' : 'password'}
                      value={config.apiKey}
                      onChange={(e) => updateConfig(provider.id, 'apiKey', e.target.value)}
                      placeholder={`Cole sua ${provider.name} API key`}
                      className="glass-input pr-12"
                    />
                    <button
                      onClick={() => toggleShowApiKey(provider.id)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-text-secondary hover:text-text-primary"
                      title={showApiKey ? 'Ocultar' : 'Mostrar'}
                    >
                      {showApiKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                {/* Model */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Modelo
                  </label>
                  <select
                    value={config.model || ''}
                    onChange={(e) => updateConfig(provider.id, 'model', e.target.value)}
                    className="glass-select"
                  >
                    <option value="">Selecione um modelo</option>
                    {AI_MODELS[provider.id].map((model) => (
                      <option key={model} value={model}>
                        {model}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Temperature */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Temperature: <span className="text-accent">{config.temperature?.toFixed(1) || '0.7'}</span>
                  </label>
                  <input
                    type="range"
                    min="0"
                    max="2"
                    step="0.1"
                    value={config.temperature || 0.7}
                    onChange={(e) => updateConfig(provider.id, 'temperature', parseFloat(e.target.value))}
                    className="w-full h-2 bg-white/5 rounded-lg appearance-none cursor-pointer accent-accent"
                  />
                  <div className="flex justify-between text-xs text-text-secondary mt-1">
                    <span>Preciso</span>
                    <span>Criativo</span>
                  </div>
                </div>

                {/* Max Tokens */}
                <div>
                  <label className="block text-sm font-medium text-text-primary mb-2">
                    Max Tokens
                  </label>
                  <input
                    type="number"
                    value={config.maxTokens || 2000}
                    onChange={(e) => updateConfig(provider.id, 'maxTokens', parseInt(e.target.value))}
                    min="100"
                    max="8000"
                    step="100"
                    className="glass-input"
                  />
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2 pt-4 border-t border-white/10">
                  <div className="flex gap-2">
                    <button
                      onClick={() => handleTestConnection(provider.id)}
                      disabled={isTesting || !config.apiKey || !config.model}
                      className="btn-secondary flex items-center justify-center gap-2 flex-1"
                    >
                      {isTesting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Testando...
                        </>
                      ) : (
                        <>
                          <Brain className="w-4 h-4" />
                          Testar Conexão
                        </>
                      )}
                    </button>

                    <button
                      onClick={() => handleSave(provider.id)}
                      disabled={isSaving || !config.apiKey || !config.model}
                      className="btn-primary flex items-center justify-center gap-2 flex-1"
                    >
                      {isSaving ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          Salvando...
                        </>
                      ) : (
                        <>
                          <Check className="w-4 h-4" />
                          Salvar
                        </>
                      )}
                    </button>
                  </div>

                  {state.isSaved && !state.isActive && (
                    <button
                      onClick={() => handleActivate(provider.id)}
                      disabled={isActivating}
                      className="btn-primary bg-gradient-to-r from-emerald-500 to-emerald-600 hover:from-emerald-600 hover:to-emerald-700 flex items-center justify-center gap-2 w-full"
                    >
                      {isActivating ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Ativando...
                        </>
                      ) : (
                        <>
                          <CheckCircle className="w-5 h-5" />
                          Ativar {provider.name}
                        </>
                      )}
                    </button>
                  )}

                  {state.isActive && (
                    <div className="p-3 bg-emerald-500/10 border-2 border-emerald-500/50 rounded-xl">
                      <p className="text-sm text-emerald-400 font-semibold text-center flex items-center justify-center gap-2">
                        <CheckCircle className="w-5 h-5" />
                        Provedor Ativo - Pronto para uso!
                      </p>
                    </div>
                  )}
                </div>
              </div>
            </GlassCard>
          );
        })}
      </div>
    </div>
  );
}
