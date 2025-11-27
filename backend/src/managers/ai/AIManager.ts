import OpenAI from 'openai';
import Anthropic from '@anthropic-ai/sdk';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { configStore } from '../../config/ConfigStore';
import { apiKeyManager } from '../services/APIKeyManager';
import { cacheManager } from '../services/CacheManager';
import { retryManager } from '../services/RetryManager';
import { queueManager } from '../services/QueueManager';
import { observabilityManager } from '../services/ObservabilityManager';
import { modelFallbackManager } from '../services/ModelFallbackManager';
import type { AIProvider, AIConfig, AIProviderConfig, AIConfigMode } from '../../shared/types';

// ============================================
// AI MANAGER - Multi-Provider com Fallback
// ============================================

export class AIManager {
  private activeProvider: AIProvider | null = null;
  private configs: AIProviderConfig = {};

  constructor() {
    this.loadConfigs();
  }

  // ===== Config Management =====
  private loadConfigs(): void {
    const savedConfigs = configStore.get('ai');
    if (savedConfigs) {
      this.configs = savedConfigs as AIProviderConfig;

      // Encontrar provider ativo
      for (const [provider, config] of Object.entries(this.configs)) {
        if (config?.isActive) {
          this.activeProvider = provider as AIProvider;
          break;
        }
      }
    }
  }

  /**
   * AUTO-CONFIGURAÇÃO: Detecta e configura automaticamente baseado nas chaves disponíveis
   */
  async autoConfigureFromAvailableKeys(): Promise<{ success: boolean; message: string; provider?: AIProvider }> {
    try {
      const allKeys = apiKeyManager.getAllKeys();
      const activeKeys = allKeys.filter(key => key.isActive);

      if (activeKeys.length === 0) {
        return {
          success: false,
          message: '❌ Nenhuma chave ativa encontrada. Configure pelo menos uma chave no gerenciador.'
        };
      }

      // Conta chaves por provider
      const keyCounts: Record<AIProvider, number> = {
        openai: activeKeys.filter(k => k.provider === 'openai').length,
        claude: activeKeys.filter(k => k.provider === 'claude').length,
        gemini: activeKeys.filter(k => k.provider === 'gemini').length,
        openrouter: activeKeys.filter(k => k.provider === 'openrouter').length
      };

      // Encontra o provider com mais chaves
      const bestProvider = Object.entries(keyCounts).reduce((a, b) =>
        keyCounts[a[0] as AIProvider] > keyCounts[b[0] as AIProvider] ? a : b
      )[0] as AIProvider;

      if (keyCounts[bestProvider] === 0) {
        return {
          success: false,
          message: '❌ Nenhuma chave ativa encontrada'
        };
      }

      // Pega a primeira chave ativa do melhor provider
      const firstKey = activeKeys.find(k => k.provider === bestProvider);
      if (!firstKey) {
        return {
          success: false,
          message: '❌ Erro ao encontrar chave para configuração automática'
        };
      }

      // Configura automaticamente
      const model = this.getDefaultModelForProvider(bestProvider);
      await this.saveConfig(bestProvider, {
        provider: bestProvider,
        apiKey: firstKey.key,
        model: model,
        temperature: 0.7,
        maxTokens: 2000,
        isActive: false, // Não ativa automaticamente, apenas configura
        configMode: 'manual', // Usa como manual mas o sistema usará rotação nos bastidores
        useKeyRotation: true // Ativa rotação automaticamente
      });

      console.log(`[AIManager] ✅ Auto-configurado para ${bestProvider} com ${keyCounts[bestProvider]} chave(s)`);

      return {
        success: true,
        message: `✅ Configurado automaticamente para ${bestProvider.toUpperCase()} com ${keyCounts[bestProvider]} chave(s). Agora ative o provider!`,
        provider: bestProvider
      };
    } catch (error) {
      console.error('[AIManager] Erro na auto-configuração:', error);
      return {
        success: false,
        message: `❌ Erro na configuração automática: ${error instanceof Error ? error.message : 'Erro desconhecido'}`
      };
    }
  }

  private getDefaultModelForProvider(provider: AIProvider): string {
    const defaultModels = {
      openai: 'gpt-4-turbo-preview',
      claude: 'claude-3-sonnet-20240229',
      gemini: 'gemini-2.0-flash', // ✅ Modelo padrão testado e funcionando (15 RPM, 1M TPM, 200 RPD) - Atualizado 24/11/2025
      openrouter: 'openai/gpt-4-turbo-preview'
    };
    return defaultModels[provider];
  }

  async saveConfig(provider: AIProvider, config: AIConfig): Promise<void> {
    console.log(`[AIManager] Salvando configuração para ${provider}...`);
    console.log(`[AIManager] Config recebida:`, {
      hasApiKey: !!config.apiKey,
      apiKeyLength: config.apiKey?.length || 0,
      model: config.model,
      temperature: config.temperature,
      maxTokens: config.maxTokens,
      configMode: config.configMode || 'manual',
      useKeyRotation: config.useKeyRotation || false
    });

    const configMode: AIConfigMode = config.configMode || 'manual';

    // Se modo manual, validar e salvar API key
    if (configMode === 'manual') {
      if (config.apiKey) {
        const apiKey = config.apiKey.trim();
        if (!apiKey) {
          throw new Error('API key não pode estar vazia');
        }

        // Validações básicas por provider
        if (provider === 'openai' && !apiKey.startsWith('sk-') && !apiKey.startsWith('sk_')) {
          console.warn('[AIManager] API key do OpenAI pode estar em formato incorreto');
        }
        if (provider === 'claude' && !apiKey.startsWith('sk-ant-')) {
          console.warn('[AIManager] API key do Claude pode estar em formato incorreto');
        }

        // Salvar API key de forma segura
        configStore.setSecureKey(provider, apiKey);
        console.log(`[AIManager] API key salva com sucesso para ${provider}`);
      }
    } else {
      // Modo keypool: verificar se há chaves disponíveis
      const availableKeys = apiKeyManager.getKeysByProvider(provider);
      if (availableKeys.length === 0) {
        throw new Error(`Nenhuma chave disponível no pool para ${provider}`);
      }
      console.log(`[AIManager] Modo keypool: ${availableKeys.length} chave(s) disponível(is)`);
    }

    // Salvar resto da config (incluindo isActive, configMode, useKeyRotation)
    const configWithoutKey = { ...config };
    delete (configWithoutKey as { apiKey?: string }).apiKey;

    // Garantir que configMode e useKeyRotation estão definidos
    configWithoutKey.configMode = configMode;
    configWithoutKey.useKeyRotation = configMode === 'keypool' ? true : (config.useKeyRotation || false);

    // Usar o isActive que vem do config
    if (configWithoutKey.isActive === undefined) {
      const existingConfig = this.configs[provider];
      configWithoutKey.isActive = existingConfig?.isActive || false;
    }

    this.configs[provider] = configWithoutKey as AIConfig;

    // Salvar config preservando a API key criptografada (se existir)
    const aiConfig = configStore.get('ai') || {};
    const existingProviderConfig = aiConfig[provider] || {};

    configStore.set('ai', {
      ...aiConfig,
      [provider]: {
        ...(existingProviderConfig as any), // Preserva apiKey criptografada
        ...configWithoutKey,        // Sobrescreve outras propriedades
      },
    });

    console.log(`[AIManager] Configuração salva com sucesso para ${provider}`);
    console.log(`[AIManager] Modo: ${configMode}, isActive: ${configWithoutKey.isActive}`);
  }

  getConfig(provider?: AIProvider): AIConfig | AIProviderConfig | null {
    console.log(`[AIManager] Buscando config para ${provider || 'todos os providers'}...`);

    if (provider) {
      const config = this.configs[provider];
      if (!config) {
        console.log(`[AIManager] Nenhuma config encontrada para ${provider}`);
        return null;
      }

      // Buscar API key
      const apiKey = configStore.getSecureKey(provider);
      const result = { ...config, apiKey: apiKey || '' };
      console.log(`[AIManager] Config encontrada para ${provider}:`, {
        hasApiKey: !!result.apiKey,
        apiKeyLength: result.apiKey?.length || 0,
        model: result.model
      });
      return result;
    }

    // Retornar todas as configs
    const allConfigs: Record<string, AIConfig> = {};
    for (const [prov, conf] of Object.entries(this.configs)) {
      if (conf) {
        const apiKey = configStore.getSecureKey(prov);
        allConfigs[prov] = { ...conf, apiKey: apiKey || '' };
      }
    }
    console.log(`[AIManager] Retornando ${Object.keys(allConfigs).length} configurações`);
    return allConfigs;
  }

  async setActiveProvider(provider: AIProvider): Promise<void> {
    console.log(`[AIManager] Definindo provider ativo: ${provider}`);

    // Desativar todos
    for (const key of Object.keys(this.configs)) {
      if (this.configs[key as AIProvider]) {
        this.configs[key as AIProvider]!.isActive = false;
        console.log(`[AIManager] Desativado: ${key}`);
      }
    }

    // Ativar o selecionado
    if (this.configs[provider]) {
      this.configs[provider]!.isActive = true;
      this.activeProvider = provider;
      console.log(`[AIManager] Ativado: ${provider}`);
    } else {
      console.error(`[AIManager] Provider ${provider} não encontrado nas configs!`);
      throw new Error(`Provider ${provider} não está configurado`);
    }

    // Salvar
    configStore.set('ai', this.configs);
    console.log(`[AIManager] Configurações salvas. Provider ativo: ${this.activeProvider}`);
  }

  getActiveProvider(): AIProvider | null {
    return this.activeProvider;
  }

  /**
   * Gera resposta da IA com FALLBACK AUTOMÁTICO, ROTAÇÃO DE CHAVES, CACHE, RETRY e QUEUE
   * Este é o método principal que deve ser usado para requisições
   */
  async generateResponse(prompt: string, useKeyRotation: boolean = true): Promise<string> {
    if (!this.activeProvider) {
      throw new Error('Nenhum provider de IA ativo. Configure e ative um provider primeiro.');
    }

    const config = this.configs[this.activeProvider];
    if (!config) {
      throw new Error(`Configuração não encontrada para ${this.activeProvider}`);
    }

    // 1. VERIFICAR CACHE PRIMEIRO
    const cachedResponse = cacheManager.getCachedResponse(
      prompt,
      this.activeProvider,
      config.model,
      config.temperature
    );
    if (cachedResponse) {
      console.log('[AIManager] ✅ Resposta retornada do cache');
      return cachedResponse;
    }

    // Garantir que activeProvider não é null
    const provider = this.activeProvider;
    if (!provider) {
      throw new Error('Provider não está ativo');
    }

    // 2. ENFILEIRAR REQUISIÇÃO (com retry e observability integrados)
    return queueManager.enqueue(
      'llm_request',
      provider,
      { prompt, config, useKeyRotation },
      5, // Prioridade média
      async () => {
        const startTime = Date.now();
        let keyId: string | undefined;
        let apiKey: string | undefined;

        try {
          // Executar com retry e circuit breaker
          const response = await retryManager.executeWithRetry(
            async () => {
              // Pega API key
              const savedKey = configStore.getSecureKey(provider);
              apiKey = savedKey || undefined;

              // Sistema de rotação inteligente
              if (useKeyRotation || config.useKeyRotation) {
                const nextKey = await apiKeyManager.getNextKey(provider);
                if (nextKey) {
                  // Verifica rate limit específico por provider/modelo
                  if (!apiKeyManager.canMakeRequest(nextKey.id, provider, config.model)) {
                    const delay = apiKeyManager.getNextRequestDelay(nextKey.id, provider, config.model);
                    if (delay > 0) {
                      console.log(`[AIManager] ⏳ Aguardando ${Math.round(delay / 1000)}s para chave ${nextKey.label}...`);
                      await new Promise(resolve => setTimeout(resolve, delay));
                    }
                  }

                  apiKey = nextKey.key;
                  keyId = nextKey.id;
                  console.log(`[AIManager] 🔑 Usando key rotacionada: ${nextKey.label}`);
                }
              }

              if (!apiKey) {
                throw new Error('API Key não configurada');
              }

              // Gerar resposta
              const tempConfig = { ...config, apiKey };
              let result: string;

              switch (provider) {
                case 'openai':
                  result = await this.callOpenAI(prompt, tempConfig);
                  break;
                case 'claude':
                  result = await this.callClaude(prompt, tempConfig);
                  break;
                case 'gemini':
                  result = await this.callGemini(prompt, tempConfig);
                  break;
                case 'openrouter':
                  result = await this.callOpenRouter(prompt, tempConfig);
                  break;
                default:
                  throw new Error(`Provider ${provider} não suportado`);
              }

              return result;
            },
            `ai_${provider}_${config.model}`
          );

          // Registrar sucesso
          const responseTime = Date.now() - startTime;
          if (keyId) {
            await apiKeyManager.recordRequest(keyId, true, responseTime);
          }

          // Armazenar em cache
          cacheManager.setCachedResponse(prompt, provider, config.model, response);

          // Registrar métrica de sucesso
          observabilityManager.recordMetric({
            endpoint: 'generateResponse',
            provider: provider,
            duration: responseTime,
            success: true,
            statusCode: 200,
          });

          return response;
        } catch (error: any) {
          const responseTime = Date.now() - startTime;

          // Registrar falha
          if (keyId) {
            await apiKeyManager.recordRequest(keyId, false);
          }

          // Registrar métrica de erro
          const statusCode = error?.status || error?.statusCode || error?.response?.status || 500;
          observabilityManager.recordMetric({
            endpoint: 'generateResponse',
            provider: provider,
            duration: responseTime,
            success: false,
            statusCode,
            errorType: error?.message || 'unknown',
          });

          throw error;
        }
      }
    );
  }

  // ===== Test Connection =====
  async testConnection(provider: AIProvider, config: AIConfig): Promise<boolean> {
    try {
      // Validar e limpar API key
      if (!config.apiKey) {
        throw new Error('API key não fornecida');
      }

      const apiKey = config.apiKey.trim();
      if (!apiKey) {
        throw new Error('API key está vazia');
      }

      // Validar formato básico da API key
      if (apiKey.length < 10) {
        throw new Error('API key parece estar incompleta ou inválida');
      }

      // Criar config limpa
      const cleanConfig: AIConfig = {
        ...config,
        apiKey,
      };

      switch (provider) {
        case 'openai':
          return await this.testOpenAI(cleanConfig);
        case 'claude':
          return await this.testClaude(cleanConfig);
        case 'gemini':
          return await this.testGemini(cleanConfig);
        case 'openrouter':
          return await this.testOpenRouter(cleanConfig);
        default:
          return false;
      }
    } catch (error) {
      console.error(`Test connection failed for ${provider}:`, error);
      // Re-throw para que o erro seja capturado pelo handler IPC
      throw error;
    }
  }

  private async testOpenAI(config: AIConfig): Promise<boolean> {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API key do OpenAI não fornecida');
    }

    const apiKey = config.apiKey.trim();

    // Validar formato da API key do OpenAI (começa com 'sk-')
    if (!apiKey.startsWith('sk-') && !apiKey.startsWith('sk_')) {
      console.warn('API key do OpenAI pode estar em formato incorreto (deve começar com "sk-")');
    }

    const client = new OpenAI({
      apiKey,
      timeout: 30000, // 30 segundos de timeout
    });

    const response = await client.chat.completions.create({
      model: config.model || 'gpt-3.5-turbo',
      messages: [{ role: 'user', content: 'Hi' }],
      max_tokens: 10,
    });

    return !!response.choices[0];
  }

  private async testClaude(config: AIConfig): Promise<boolean> {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API key do Claude não fornecida');
    }

    const apiKey = config.apiKey.trim();

    // Validar formato da API key do Claude (começa com 'sk-ant-')
    if (!apiKey.startsWith('sk-ant-')) {
      console.warn('API key do Claude pode estar em formato incorreto (deve começar com "sk-ant-")');
    }

    const client = new Anthropic({
      apiKey,
    });

    // @ts-ignore: Anthropic SDK types may not be fully up to date
    const response = await client.messages.create({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: 10,
      messages: [{ role: 'user', content: 'Hi' }],
    });

    return !!response.content[0];
  }

  private async testGemini(config: AIConfig): Promise<boolean> {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API key do Gemini não fornecida');
    }

    const apiKey = config.apiKey.trim();
    const genAI = new GoogleGenerativeAI(apiKey);
    // ✅ Usa gemini-2.0-flash como padrão (testado e funcionando - 15 RPM, 1M TPM, 200 RPD)
    // Atualizado 24/11/2025 - Modelos testados: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-2.5-flash, gemini-2.5-flash-lite
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' });
    const result = await model.generateContent('Hi');
    const response = await result.response;
    return !!response.text();
  }

  private async testOpenRouter(config: AIConfig): Promise<boolean> {
    if (!config.apiKey || !config.apiKey.trim()) {
      throw new Error('API key do OpenRouter não fornecida');
    }

    const apiKey = config.apiKey.trim();

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model || 'anthropic/claude-3-sonnet',
        messages: [{ role: 'user', content: 'Hi' }],
        max_tokens: 10,
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
    }

    return response.ok;
  }

  // ===== Call Methods (para generateResponse) =====
  private async callOpenAI(prompt: string, config: AIConfig): Promise<string> {
    console.log('[AIManager] 📤 Chamando OpenAI...');
    const openai = new OpenAI({ apiKey: config.apiKey });

    const response = await openai.chat.completions.create({
      model: config.model || 'gpt-4-turbo-preview',
      messages: [{ role: 'user', content: prompt }],
      temperature: config.temperature || 0.7,
      max_tokens: config.maxTokens || 2000,
    });

    const result = response.choices[0]?.message?.content;
    if (!result) {
      throw new Error('OpenAI não retornou resposta');
    }

    console.log('[AIManager] ✅ Resposta recebida da OpenAI');
    return result;
  }

  private async callClaude(prompt: string, config: AIConfig): Promise<string> {
    console.log('[AIManager] 📤 Chamando Claude...');
    const anthropic = new Anthropic({ apiKey: config.apiKey });

    // @ts-ignore - Anthropic SDK typing issue
    const message = await anthropic.messages.create({
      model: config.model || 'claude-3-sonnet-20240229',
      max_tokens: config.maxTokens || 2000,
      messages: [{ role: 'user', content: prompt }],
    });

    const content = message.content[0];
    if (!content || content.type !== 'text') {
      throw new Error('Claude não retornou resposta válida');
    }

    console.log('[AIManager] ✅ Resposta recebida do Claude');
    return content.text;
  }

  private async callGemini(prompt: string, config: AIConfig): Promise<string> {
    console.log('[AIManager] 📤 Chamando Gemini...');
    const genAI = new GoogleGenerativeAI(config.apiKey!);
    // ✅ Usa gemini-2.0-flash como padrão (testado e funcionando - 15 RPM, 1M TPM, 200 RPD)
    // Atualizado 24/11/2025 - Modelos testados e funcionando:
    // - gemini-2.0-flash (padrão, 15 RPM)
    // - gemini-2.0-flash-lite (30 RPM - mais rápido)
    // - gemini-2.5-flash (10 RPM)
    // - gemini-2.5-flash-lite (15 RPM)
    const model = genAI.getGenerativeModel({
      model: config.model || 'gemini-2.0-flash'
    });

    const result = await model.generateContent(prompt);
    const response = await result.response;
    const text = response.text();

    if (!text) {
      throw new Error('Gemini não retornou resposta');
    }

    console.log('[AIManager] ✅ Resposta recebida do Gemini');
    return text;
  }

  private async callOpenRouter(prompt: string, config: AIConfig): Promise<string> {
    console.log('[AIManager] 📤 Chamando OpenRouter...');

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
        'HTTP-Referer': 'https://agentwhatsa.app',
        'X-Title': 'AgentWhatsA'
      },
      body: JSON.stringify({
        model: config.model || 'anthropic/claude-3-sonnet',
        messages: [{ role: 'user', content: prompt }],
        temperature: config.temperature || 0.7,
        max_tokens: config.maxTokens || 2000,
      }),
    });

    if (!response.ok) {
      const errorData: any = await response.json().catch(() => ({}));
      throw new Error(errorData.error?.message || `Erro HTTP ${response.status}`);
    }

    const data: any = await response.json();
    const result = data.choices[0]?.message?.content;

    if (!result) {
      throw new Error('OpenRouter não retornou resposta');
    }

    console.log('[AIManager] ✅ Resposta recebida do OpenRouter');
    return result;
  }

  // ===== Generate Response =====
  async generate(prompt: string, systemPrompt?: string, useKeyRotation: boolean = false): Promise<string> {
    if (!this.activeProvider) {
      throw new Error('No active AI provider');
    }

    const config = this.configs[this.activeProvider];
    if (!config) {
      throw new Error('Active provider not configured');
    }

    // Determinar se deve usar rotação de keys
    const shouldUseRotation = useKeyRotation || config.configMode === 'keypool' || config.useKeyRotation;

    let apiKey: string;
    let keyId: string | undefined;
    const startTime = Date.now();

    if (shouldUseRotation && config.configMode === 'keypool') {
      // Usar rotação de keys do pool
      const nextKey = await apiKeyManager.getNextKey(this.activeProvider);
      if (nextKey) {
        // Verificar rate limit
        if (!apiKeyManager.canMakeRequest(nextKey.id)) {
          const delay = apiKeyManager.getNextRequestDelay(nextKey.id);
          if (delay > 0) {
            console.log(`[AIManager] ⏳ Aguardando ${Math.round(delay / 1000)}s para chave ${nextKey.label}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        apiKey = nextKey.key;
        keyId = nextKey.id;
        console.log(`[AIManager] 🔑 Usando key rotacionada: ${nextKey.label}`);
      } else {
        // Fallback para key manual se pool não disponível
        const manualKey = configStore.getSecureKey(this.activeProvider);
        if (!manualKey) {
          throw new Error('Nenhuma chave disponível no pool e nenhuma chave manual configurada');
        }
        apiKey = manualKey;
        console.warn('[AIManager] ⚠️ Nenhuma key disponível no pool, usando key manual');
      }
    } else {
      // Modo manual: usar key salva
      const savedKey = configStore.getSecureKey(this.activeProvider);
      if (!savedKey) {
        throw new Error('API key not found');
      }
      apiKey = savedKey;
    }

    try {
      let result: string;
      const configWithKey = { ...config, apiKey };

      switch (this.activeProvider) {
        case 'openai':
          result = await this.generateOpenAI(configWithKey, prompt, systemPrompt);
          break;
        case 'claude':
          result = await this.generateClaude(configWithKey, prompt, systemPrompt);
          break;
        case 'gemini':
          result = await this.generateGemini(configWithKey, prompt, systemPrompt);
          break;
        case 'openrouter':
          result = await this.generateOpenRouter(configWithKey, prompt, systemPrompt);
          break;
        default:
          throw new Error('Unknown provider');
      }

      // Registrar sucesso se usar rotação
      if (keyId) {
        const responseTime = Date.now() - startTime;
        await apiKeyManager.recordRequest(keyId, true, responseTime);
      }

      return result;
    } catch (error) {
      // Registrar falha se usar rotação
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, false);
      }

      // Tentar fallback se usar rotação
      if (shouldUseRotation && config.configMode === 'keypool' && this.activeProvider !== 'openai') {
        console.log(`[AIManager] 🔄 Tentando com próxima chave após erro...`);
        try {
          const nextKey = await apiKeyManager.getNextKey(this.activeProvider);
          if (nextKey && nextKey.id !== keyId) {
            console.log(`[AIManager] 🔑 Tentando com chave de fallback: ${nextKey.label}`);
            return await this.generate(prompt, systemPrompt, false); // Não usar rotação para evitar loop
          }
        } catch (fallbackError) {
          console.error('[AIManager] ❌ Fallback também falhou:', fallbackError);
        }
      }

      throw error;
    }
  }

  // ===== Generate with Agent Config =====
  // Permite gerar respostas usando configurações customizadas de um agente
  async generateWithAgent(
    agentProvider: AIProvider,
    agentModel: string,
    agentTemperature: number,
    agentMaxTokens: number,
    prompt: string,
    systemPrompt?: string,
    useKeyRotation: boolean = false
  ): Promise<string> {
    console.log(`[AIManager] 🔧 generateWithAgent - Provider: ${agentProvider}, Model: ${agentModel}`);

    // Buscar config base (pode não existir se usar apenas pool de keys)
    const baseConfig = this.configs[agentProvider];

    // Verificar se há chaves disponíveis (pool ou manual)
    const poolKeys = apiKeyManager.getKeysByProvider(agentProvider);
    const manualKey = baseConfig ? configStore.getSecureKey(agentProvider) : null;

    if (!baseConfig && poolKeys.length === 0 && !manualKey) {
      throw new Error(
        `Provider ${agentProvider} não está configurado e não há chaves disponíveis.\n` +
        `Configure em: Configurações > AI > ${agentProvider} ou adicione keys em API Keys.`
      );
    }

    // Criar configuração customizada do agente
    // Se não houver baseConfig, criar uma mínima
    const agentConfig: AIConfig = baseConfig ? {
      ...baseConfig,
      model: agentModel,
      temperature: agentTemperature,
      maxTokens: agentMaxTokens,
      apiKey: '', // Será preenchido depois
    } : {
      provider: agentProvider,
      model: agentModel,
      temperature: agentTemperature,
      maxTokens: agentMaxTokens,
      apiKey: '', // Será preenchido depois
      isActive: false,
      configMode: poolKeys.length > 0 ? 'keypool' : 'manual',
      useKeyRotation: poolKeys.length > 0,
    };

    let apiKey: string | undefined;
    let keyId: string | undefined;
    const startTime = Date.now();

    // Determinar se deve usar rotação de keys
    const shouldUseRotation = useKeyRotation || agentConfig.configMode === 'keypool' || agentConfig.useKeyRotation || poolKeys.length > 0;
    console.log(`[AIManager] Config mode: ${agentConfig.configMode}, Should use rotation: ${shouldUseRotation}, Pool keys: ${poolKeys.length}`);

    // 🎯 OTIMIZAÇÃO INTELIGENTE: Selecionar modelo baseado na complexidade da query
    const optimalModel = modelFallbackManager.selectOptimalModel(agentProvider, prompt);
    if (optimalModel.model !== agentModel) {
      console.log(`[AIManager] 🎯 Modelo otimizado selecionado: ${agentModel} → ${optimalModel.model}`);
      agentModel = optimalModel.model;
      // Atualizar config do agente com modelo otimizado
      agentConfig.model = optimalModel.model;
    }

    // Primeira tentativa: buscar do pool de keys se rotação estiver habilitada
    if (shouldUseRotation && poolKeys.length > 0) {
      console.log(`[AIManager] 🔄 Tentando buscar key do pool...`);
      const nextKey = await apiKeyManager.getNextKey(agentProvider);
      if (nextKey) {
        // Verificar rate limit
        if (!apiKeyManager.canMakeRequest(nextKey.id)) {
          const delay = apiKeyManager.getNextRequestDelay(nextKey.id);
          if (delay > 0) {
            console.log(`[AIManager] ⏳ Aguardando ${Math.round(delay / 1000)}s para chave ${nextKey.label}...`);
            await new Promise(resolve => setTimeout(resolve, delay));
          }
        }

        apiKey = nextKey.key;
        keyId = nextKey.id;
        console.log(`[AIManager] 🔑 Usando key rotacionada: ${nextKey.label}`);
      } else {
        console.log(`[AIManager] ⚠️ Nenhuma key no pool, tentando key manual...`);
      }
    }

    // Segunda tentativa: buscar key manual da config se não encontrou no pool
    if (!apiKey) {
      console.log(`[AIManager] 🔍 Buscando key manual da config...`);
      const savedKey = baseConfig ? configStore.getSecureKey(agentProvider) : manualKey;
      if (savedKey) {
        apiKey = savedKey;
        console.log(`[AIManager] 🔑 Usando key manual da config`);
      }
    }

    // Se ainda não encontrou, tentar pegar qualquer chave do pool
    if (!apiKey && poolKeys.length > 0) {
      console.log(`[AIManager] 🔍 Tentando usar primeira chave do pool...`);
      const firstKey = poolKeys[0];
      apiKey = firstKey.key;
      keyId = firstKey.id;
      console.log(`[AIManager] 🔑 Usando primeira chave do pool: ${firstKey.label}`);
    }

    // Última verificação
    if (!apiKey) {
      throw new Error(
        `API key não encontrada para ${agentProvider}.\n` +
        `Configure em: Configurações > AI > ${agentProvider} ou adicione keys em API Keys.`
      );
    }

    try {
      let result: string;
      const configWithKey = { ...agentConfig, apiKey };

      switch (agentProvider) {
        case 'openai':
          result = await this.generateOpenAI(configWithKey, prompt, systemPrompt);
          break;
        case 'claude':
          result = await this.generateClaude(configWithKey, prompt, systemPrompt);
          break;
        case 'gemini':
          result = await this.generateGemini(configWithKey, prompt, systemPrompt);
          break;
        case 'openrouter':
          result = await this.generateOpenRouter(configWithKey, prompt, systemPrompt);
          break;
        default:
          throw new Error('Unknown provider');
      }

      // Registrar sucesso se usar rotação
      if (keyId) {
        const responseTime = Date.now() - startTime;
        await apiKeyManager.recordRequest(keyId, true, responseTime);
      }

      return result;
    } catch (error) {
      // Registrar falha se usar rotação
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, false);
      }

      // 🔄 FALLBACK INTELIGENTE: Detectar erro de quota e tentar próximo modelo
      if (modelFallbackManager.isQuotaError(error)) {
        console.log(`[AIManager] ⚠️ Erro de quota detectado para ${agentProvider}/${agentModel}`);
        modelFallbackManager.markQuotaExceeded(agentProvider, agentModel);

        const fallbackModel = modelFallbackManager.getNextModel(agentProvider, agentModel);
        if (fallbackModel) {
          console.log(`[AIManager] 🔄 Tentando fallback: ${agentModel} → ${fallbackModel.model}`);

          // Tentar com modelo de fallback
          try {
            return await this.generateWithAgent(
              fallbackModel.provider,
              fallbackModel.model,
              agentTemperature,
              agentMaxTokens,
              prompt,
              systemPrompt,
              useKeyRotation
            );
          } catch (fallbackError) {
            console.error(`[AIManager] ❌ Fallback também falhou:`, fallbackError);
            // Se o fallback falhou, lançar o erro original
            throw error;
          }
        } else {
          console.error(`[AIManager] ❌ Nenhum modelo de fallback disponível`);
        }
      }

      throw error;
    }
  }

  // ===== Generate with Function Calling =====
  // Permite que o agente chame funções para buscar dados do banco
  async generateWithFunctions(
    agentProvider: AIProvider,
    agentModel: string,
    agentTemperature: number,
    agentMaxTokens: number,
    prompt: string,
    systemPrompt: string,
    functions: any[], // OpenAI function definitions
    availableFunctions: Record<string, Function>
  ): Promise<string> {
    console.log(`[AIManager] 🔧 generateWithFunctions - Provider: ${agentProvider}`);

    // Apenas OpenAI suporta function calling nativamente
    if (agentProvider !== 'openai') {
      console.warn(`[AIManager] ⚠️ Function calling não suportado para ${agentProvider}, usando geração normal`);
      return this.generateWithAgent(
        agentProvider,
        agentModel,
        agentTemperature,
        agentMaxTokens,
        prompt,
        systemPrompt,
        true
      );
    }

    // Verifica se o provider está configurado
    const baseConfig = this.configs[agentProvider];
    if (!baseConfig) {
      throw new Error(`Provider ${agentProvider} não está configurado.`);
    }

    // Buscar API key
    // CORREÇÃO CRÍTICA: Sempre tentar pool de chaves primeiro, independente do modo de configuração
    // O pool de chaves é a fonte primária, e a chave manual é apenas um fallback
    let apiKey: string | undefined;
    let keyId: string | undefined;

    console.log(`[AIManager] 🔍 Buscando API key para ${agentProvider}...`);
    console.log(`[AIManager] Config mode: ${baseConfig.configMode}, useKeyRotation: ${baseConfig.useKeyRotation}`);

    // PRIMEIRA TENTATIVA: Sempre tentar buscar do pool de keys primeiro
    // Isso garante que mesmo em modo manual, se houver chaves no pool, elas serão usadas
    console.log(`[AIManager] 🔄 Tentando buscar do pool de keys...`);
    const nextKey = await apiKeyManager.getNextKey(agentProvider);
    if (nextKey) {
      apiKey = nextKey.key;
      keyId = nextKey.id;
      console.log(`[AIManager] ✅ Key encontrada no pool: ${nextKey.label} (${nextKey.id})`);
    } else {
      console.log(`[AIManager] ⚠️ Nenhuma key disponível no pool`);
    }

    // SEGUNDA TENTATIVA: chave manual da config (apenas se não encontrou no pool)
    if (!apiKey) {
      console.log(`[AIManager] 🔍 Tentando buscar key manual da config...`);
      const manualKey = configStore.getSecureKey(agentProvider);
      if (manualKey) {
        apiKey = manualKey;
        console.log(`[AIManager] ✅ Key manual encontrada`);
      } else {
        console.log(`[AIManager] ❌ Key manual não encontrada`);
      }
    }

    // Se ainda não encontrou, lançar erro detalhado
    if (!apiKey) {
      throw new Error(
        `API key não encontrada para ${agentProvider}.\n` +
        `Verifique:\n` +
        `1. Se há keys ativas no gerenciador de API Keys\n` +
        `2. Se o provider ${agentProvider} está configurado em Configurações > AI\n` +
        `3. Se a key foi salva corretamente`
      );
    }

    const client = new OpenAI({ apiKey });

    // Primeira chamada: com functions
    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [
      { role: 'system', content: systemPrompt },
      { role: 'user', content: prompt }
    ];

    console.log(`[AIManager] 📞 Chamando OpenAI com ${functions.length} funções disponíveis`);

    const startTime = Date.now();
    let response;

    try {
      response = await client.chat.completions.create({
        model: agentModel,
        messages,
        functions,
        function_call: 'auto',
        temperature: agentTemperature,
        max_tokens: agentMaxTokens,
      });

      // Registrar sucesso se estiver usando chave do pool
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, true);
        const duration = Date.now() - startTime;
        console.log(`[AIManager] ✅ Requisição bem-sucedida em ${duration}ms`);
      }
    } catch (error: any) {
      // Registrar erro se estiver usando chave do pool
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, false);
      }

      const errorMsg = error?.message || error?.toString() || 'Erro desconhecido';
      console.error(`[AIManager] ❌ Erro na requisição: ${errorMsg}`);

      // Se for erro de autenticação e estiver usando chave do pool, tentar próxima chave
      if (keyId && (errorMsg.includes('401') || errorMsg.includes('Invalid API key') || errorMsg.includes('authentication'))) {
        console.log(`[AIManager] 🔄 Erro de autenticação detectado. Tentando próxima chave do pool...`);
        const nextKey = await apiKeyManager.getNextKey(agentProvider);
        if (nextKey && nextKey.id !== keyId) {
          console.log(`[AIManager] 🔄 Tentando com próxima chave: ${nextKey.label}`);
          const retryClient = new OpenAI({ apiKey: nextKey.key });
          response = await retryClient.chat.completions.create({
            model: agentModel,
            messages,
            functions,
            function_call: 'auto',
            temperature: agentTemperature,
            max_tokens: agentMaxTokens,
          });
          await apiKeyManager.recordRequest(nextKey.id, true);
          console.log(`[AIManager] ✅ Requisição bem-sucedida com chave alternativa`);
        } else {
          throw error; // Re-lançar se não houver próxima chave
        }
      } else {
        throw error; // Re-lançar outros erros
      }
    }

    let responseMessage = response.choices[0].message;

    // Loop para processar function calls
    while (responseMessage.function_call) {
      const functionName = responseMessage.function_call.name;
      const functionArgs = JSON.parse(responseMessage.function_call.arguments);

      console.log(`[AIManager] 🔧 Agente chamou função: ${functionName}`);
      console.log(`[AIManager] 📋 Argumentos:`, functionArgs);

      // Executar a função
      const functionToCall = availableFunctions[functionName];
      if (!functionToCall) {
        throw new Error(`Função ${functionName} não encontrada`);
      }

      const functionResponse = await functionToCall(functionArgs);
      console.log(`[AIManager] ✅ Função retornou ${Array.isArray(functionResponse) ? functionResponse.length : 1} resultado(s)`);

      // Adicionar resultado à conversa
      messages.push(responseMessage as any);
      messages.push({
        role: 'function',
        name: functionName,
        content: JSON.stringify(functionResponse),
      } as any);

      // Chamar novamente com o resultado da função
      try {
        response = await client.chat.completions.create({
          model: agentModel,
          messages,
          functions,
          function_call: 'auto',
          temperature: agentTemperature,
          max_tokens: agentMaxTokens,
        });
        responseMessage = response.choices[0].message;
      } catch (error: any) {
        // Se houver erro durante function calls, registrar e re-lançar
        if (keyId) {
          await apiKeyManager.recordRequest(keyId, false);
        }
        throw error;
      }
    }

    const finalResponse = responseMessage.content || '';
    console.log(`[AIManager] ✅ Resposta final gerada (${finalResponse.length} caracteres)`);

    return finalResponse;
  }


  private async generateOpenAI(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    const client = new OpenAI({ apiKey: config.apiKey });

    const messages: OpenAI.Chat.ChatCompletionMessageParam[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await client.chat.completions.create({
      model: config.model,
      messages,
      temperature: config.temperature,
      max_tokens: config.maxTokens,
    });

    return response.choices[0]?.message?.content || '';
  }

  private async generateClaude(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    const client = new Anthropic({ apiKey: config.apiKey });

    // @ts-ignore: Anthropic SDK types may not be fully up to date
    const response = await client.messages.create({
      model: config.model,
      max_tokens: config.maxTokens,
      temperature: config.temperature,
      system: systemPrompt,
      messages: [{ role: 'user', content: prompt }],
    });

    return response.content[0].type === 'text' ? response.content[0].text : '';
  }

  private async generateGemini(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    const genAI = new GoogleGenerativeAI(config.apiKey);
    // ✅ Usa o modelo configurado ou gemini-2.0-flash como padrão (testado e funcionando)
    // Atualizado 24/11/2025 - Modelos recomendados: gemini-2.0-flash, gemini-2.0-flash-lite, gemini-2.5-flash, gemini-2.5-flash-lite
    const model = genAI.getGenerativeModel({ model: config.model || 'gemini-2.0-flash' });

    const fullPrompt = systemPrompt ? `${systemPrompt}\n\n${prompt}` : prompt;
    const result = await model.generateContent(fullPrompt);
    const response = await result.response;

    return response.text();
  }

  private async generateOpenRouter(config: AIConfig, prompt: string, systemPrompt?: string): Promise<string> {
    const messages: { role: string; content: string }[] = [];
    if (systemPrompt) {
      messages.push({ role: 'system', content: systemPrompt });
    }
    messages.push({ role: 'user', content: prompt });

    const response = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: config.model,
        messages,
        temperature: config.temperature,
        max_tokens: config.maxTokens,
      }),
    });

    const data: any = await response.json();
    return data.choices[0]?.message?.content || '';
  }
  /**
   * Gera resposta em áudio usando Gemini Native Audio
   */
  async generateAudioWithAgent(
    provider: AIProvider,
    prompt: string
  ): Promise<{ audioBuffer: Buffer; text?: string }> {
    if (provider !== 'gemini') {
      throw new Error('Áudio nativo suportado apenas pelo provider Gemini');
    }

    // Configurar modelo de áudio TTS (Text-to-Speech via generateContent)
    const model = 'gemini-2.5-flash-preview-tts';
    console.log(`[AIManager] 🎤 Gerando áudio com modelo: ${model}`);

    // Loop de tentativas para rotação de chaves
    let lastError: any;
    const maxRetries = 3; // Tentar até 3 chaves diferentes

    for (let attempt = 0; attempt < maxRetries; attempt++) {
      let apiKey = '';
      let keyId: string | undefined;

      // 1. Tentar pegar do pool primeiro
      const nextKey = await apiKeyManager.getNextKey(provider);
      if (nextKey) {
        apiKey = nextKey.key;
        keyId = nextKey.id;
        console.log(`[AIManager] 🔑 Usando key do pool para áudio (tentativa ${attempt + 1}): ${nextKey.label}`);
      } else {
        // 2. Tentar pegar manual
        apiKey = configStore.getSecureKey(provider) || '';
        console.log(`[AIManager] 🔑 Usando key manual para áudio (tentativa ${attempt + 1})`);
      }

      if (!apiKey) {
        throw new Error('Nenhuma chave API disponível para Gemini');
      }

      try {
        // Usar REST API diretamente para TTS
        const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

        // Para TTS, NÃO incluir system prompt no texto a ser falado
        const body = {
          contents: [{
            parts: [{ text: prompt }]  // Apenas o prompt do usuário
          }],
          generationConfig: {
            response_modalities: ["AUDIO"], // Forçar resposta em áudio
            speech_config: {
              voice_config: {
                prebuilt_voice_config: {
                  voice_name: "puck" // Voz padrão (minúscula!)
                }
              }
            }
          }
        };

        const response = await fetch(url, {
          method: 'POST',
          if(!response.ok) {
            const errorData: any = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        // Se for erro de cota, lançar erro específico para acionar retry
        if (response.status === 429 || errorMessage.includes('quota')) {
          throw new Error(`Quota exceeded: ${errorMessage}`);
        }

        throw new Error(`Gemini Audio API error: ${errorMessage}`);
      }

        const data: any = await response.json();
      const audioBase64 = data.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;

      if (!audioBase64) {
        throw new Error('Nenhum áudio retornado pelo modelo');
      }

      const audioBuffer = Buffer.from(audioBase64, 'base64');

      // Debug: Primeiros bytes do áudio
      const firstBytes = audioBuffer.slice(0, 16).toString('hex');
      console.log('[AIManager] 🔍 Primeiros bytes do áudio:', firstBytes);
      console.log('[AIManager] 🔍 Tamanho do buffer:', audioBuffer.length);

      // Sucesso! Registrar uso da chave
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, true);
      }

      return {
        audioBuffer,
        text: 'Resposta em áudio gerada pelo Gemini'
      };

    } catch (error: any) {
      console.warn(`[AIManager] ⚠️ Erro na tentativa ${attempt + 1} de gerar áudio:`, error.message);
      lastError = error;

      // Registrar falha da chave
      if (keyId) {
        await apiKeyManager.recordRequest(keyId, false);
      }

      // Se não for erro de cota, talvez não adiante tentar outra chave, mas vamos tentar mesmo assim por segurança
      // Se for a última tentativa, o erro será lançado fora do loop
    }
  }

    console.error('[AIManager] ❌ Todas as tentativas de gerar áudio falharam.');
    throw lastError || new Error('Falha na geração de áudio após múltiplas tentativas.');
  }

  /**
   * Transcreve áudio usando Gemini (Speech-to-Text) com Fallback Inteligente
   */
  async transcribeAudio(audioBuffer: Buffer, mimeType: string = 'audio/ogg'): Promise < string > {
  // Lista de modelos para tentar (em ordem de preferência)
  const modelsToTry = [
    'gemini-2.0-flash',      // Melhor qualidade (Multimodal)
    'gemini-2.0-flash-lite', // Mais econômico e rápido (Multimodal)
    'gemini-1.5-flash',      // Fallback estável (Multimodal)
    'gemini-1.5-pro'         // Último recurso (Mais lento)
  ];

  let lastError: any;

  for(const model of modelsToTry) {
    try {
      console.log(`[AIManager] 🎤 Tentando transcrever com modelo: ${model}...`);

      // Obter chave API (com rotação se possível)
      let apiKey = '';
      const nextKey = await apiKeyManager.getNextKey('gemini');
      if (nextKey) {
        apiKey = nextKey.key;
      } else {
        apiKey = configStore.getSecureKey('gemini') || '';
      }

      if (!apiKey) {
        throw new Error('Nenhuma chave API disponível para Gemini');
      }

      const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

      // Converter áudio para base64
      const audioBase64 = audioBuffer.toString('base64');

      const body = {
        contents: [{
          parts: [
            {
              inlineData: {
                mimeType: mimeType,
                data: audioBase64
              }
            },
            {
              text: 'Transcreva este áudio em português. Retorne apenas o texto transcrito, sem comentários adicionais.'
            }
          ]
        }]
      };

      const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (!response.ok) {
        const errorData: any = await response.json().catch(() => ({}));
        const errorMessage = errorData.error?.message || response.statusText;

        // Se for erro de cota ou modelo não encontrado, lança erro para tentar o próximo
        if (response.status === 429 || response.status === 404 || errorMessage.includes('quota') || errorMessage.includes('not found')) {
          console.warn(`[AIManager] ⚠️ Falha com modelo ${model}: ${errorMessage}`);
          throw new Error(errorMessage);
        }

        throw new Error(`Gemini API error: ${errorMessage}`);
      }

      const data: any = await response.json();
      const transcription = data.candidates?.[0]?.content?.parts?.[0]?.text || '';

      if (!transcription) {
        throw new Error('Nenhuma transcrição retornada pelo modelo');
      }

      console.log(`[AIManager] ✅ Transcrição com ${model}: "${transcription}"`);
      return transcription.trim();

    } catch (error) {
      console.warn(`[AIManager] ⚠️ Erro ao tentar modelo ${model}:`, error);
      lastError = error;
      // Continua para o próximo modelo no loop
    }
  }

    // Se chegou aqui, todos os modelos falharam
    console.error('[AIManager] ❌ Todos os modelos de transcrição falharam.');
  throw lastError || new Error('Falha na transcrição de áudio com todos os modelos disponíveis.');
}
}
