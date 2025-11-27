// ============================================
// MODEL FALLBACK MANAGER - Intelligent Multi-Model Failover
// ============================================
// Baseado nas melhores práticas de 2024-2025 para LLM API management

import type { AIProvider } from '../../shared/types';

// ===== Types =====

export interface ModelConfig {
    provider: AIProvider;
    model: string;
    maxTokens?: number;
    temperature?: number;
}

export interface FallbackChain {
    primary: ModelConfig;
    secondary?: ModelConfig;
    tertiary?: ModelConfig;
}

export interface QuotaStatus {
    provider: AIProvider;
    model: string;
    isExceeded: boolean;
    exceededAt?: Date;
    resetAt?: Date;
}

export interface QueryComplexity {
    isSimple: boolean;
    confidence: number;
    reasoning: string;
}

// ===== Model Fallback Manager =====

export class ModelFallbackManager {
    private quotaStatus: Map<string, QuotaStatus> = new Map();
    private quotaResetHours = 24; // Padrão: 24 horas para reset de quota diária

    // Cadeias de fallback padrão baseadas na imagem fornecida
    private defaultChains: Record<AIProvider, FallbackChain> = {
        gemini: {
            primary: { provider: 'gemini', model: 'gemini-2.0-flash' },
            secondary: { provider: 'gemini', model: 'gemini-2.0-flash-lite' },
            tertiary: { provider: 'gemini', model: 'gemini-2.5-flash-lite' },
        },
        openai: {
            primary: { provider: 'openai', model: 'gpt-4-turbo-preview' },
            secondary: { provider: 'openai', model: 'gpt-3.5-turbo' },
        },
        claude: {
            primary: { provider: 'claude', model: 'claude-3-sonnet-20240229' },
            secondary: { provider: 'claude', model: 'claude-3-haiku-20240307' },
        },
        openrouter: {
            primary: { provider: 'openrouter', model: 'anthropic/claude-3-sonnet' },
            secondary: { provider: 'openrouter', model: 'anthropic/claude-3-haiku' },
        },
    };

    constructor() {
        console.log('[ModelFallbackManager] Inicializado com cadeias de fallback inteligentes');
        this.startQuotaResetMonitor();
    }

    /**
     * Detecta se um erro é relacionado a quota excedida
     */
    isQuotaError(error: any): boolean {
        const errorMsg = (error?.message || error?.toString() || '').toLowerCase();

        // Padrões comuns de erro de quota (2024-2025)
        const quotaPatterns = [
            '429',
            'too many requests',
            'quota',
            'rate limit',
            'resource_exhausted',
            'insufficient_quota',
            'free_tier_requests',
            'per day',
            'limit: 200', // Gemini free tier
            'requests per day',
            'daily limit',
        ];

        return quotaPatterns.some(pattern => errorMsg.includes(pattern));
    }

    /**
     * Registra que um modelo excedeu a quota
     */
    markQuotaExceeded(provider: AIProvider, model: string): void {
        const key = `${provider}:${model}`;
        const now = new Date();
        const resetAt = new Date(now.getTime() + this.quotaResetHours * 60 * 60 * 1000);

        this.quotaStatus.set(key, {
            provider,
            model,
            isExceeded: true,
            exceededAt: now,
            resetAt,
        });

        console.log(`[ModelFallbackManager] ⚠️ Quota excedida: ${provider}/${model}`);
        console.log(`[ModelFallbackManager] ⏰ Reset estimado em: ${resetAt.toLocaleString('pt-BR')}`);
    }

    /**
     * Verifica se um modelo está com quota excedida
     */
    isQuotaExceeded(provider: AIProvider, model: string): boolean {
        const key = `${provider}:${model}`;
        const status = this.quotaStatus.get(key);

        if (!status || !status.isExceeded) {
            return false;
        }

        // Verificar se já passou do tempo de reset
        if (status.resetAt && new Date() > status.resetAt) {
            console.log(`[ModelFallbackManager] ✅ Quota resetada para ${provider}/${model}`);
            this.quotaStatus.delete(key);
            return false;
        }

        return true;
    }

    /**
     * Obtém o próximo modelo disponível na cadeia de fallback
     */
    getNextModel(provider: AIProvider, currentModel: string): ModelConfig | null {
        const chain = this.defaultChains[provider];
        if (!chain) {
            console.warn(`[ModelFallbackManager] Nenhuma cadeia de fallback para ${provider}`);
            return null;
        }

        // Se o modelo atual é o primário e está com quota excedida, tentar secundário
        if (currentModel === chain.primary.model && chain.secondary) {
            if (!this.isQuotaExceeded(chain.secondary.provider, chain.secondary.model)) {
                console.log(`[ModelFallbackManager] 🔄 Fallback: ${currentModel} → ${chain.secondary.model}`);
                return chain.secondary;
            }
        }

        // Se o secundário também falhou, tentar terciário
        if (chain.secondary && currentModel === chain.secondary.model && chain.tertiary) {
            if (!this.isQuotaExceeded(chain.tertiary.provider, chain.tertiary.model)) {
                console.log(`[ModelFallbackManager] 🔄 Fallback: ${currentModel} → ${chain.tertiary.model}`);
                return chain.tertiary;
            }
        }

        console.warn(`[ModelFallbackManager] ❌ Nenhum modelo de fallback disponível para ${provider}/${currentModel}`);
        return null;
    }

    /**
     * Classifica a complexidade de uma query (2024-2025 best practice)
     * Queries simples podem ser roteadas para modelos mais baratos
     */
    classifyQuery(prompt: string): QueryComplexity {
        const promptLower = prompt.toLowerCase().trim();
        const wordCount = prompt.split(/\s+/).length;

        // Padrões de queries simples
        const simplePatterns = [
            // Saudações
            /^(oi|olá|ola|hey|hi|hello)$/,
            // Perguntas simples
            /^(sim|não|ok|obrigado|valeu)$/,
            // Comandos curtos
            /^(total|quantidade|quantos|quantas|lista|listar)(\s|$)/,
        ];

        // Padrões de queries complexas
        const complexPatterns = [
            /explique.*detalhad/,
            /analise/,
            /compare/,
            /recomend/,
            /sugira/,
            /como.*fazer/,
            /por que/,
            /traduza/,
            /em.*japonês|japones/,
        ];

        // Verificar padrões simples
        if (simplePatterns.some(pattern => pattern.test(promptLower))) {
            return {
                isSimple: true,
                confidence: 0.9,
                reasoning: 'Padrão de query simples detectado',
            };
        }

        // Verificar padrões complexos
        if (complexPatterns.some(pattern => pattern.test(promptLower))) {
            return {
                isSimple: false,
                confidence: 0.9,
                reasoning: 'Padrão de query complexa detectado',
            };
        }

        // Baseado no tamanho
        if (wordCount <= 5) {
            return {
                isSimple: true,
                confidence: 0.7,
                reasoning: 'Query curta (≤5 palavras)',
            };
        }

        if (wordCount > 20) {
            return {
                isSimple: false,
                confidence: 0.7,
                reasoning: 'Query longa (>20 palavras)',
            };
        }

        // Padrão: considerar complexa para garantir qualidade
        return {
            isSimple: false,
            confidence: 0.5,
            reasoning: 'Query de complexidade média - usando modelo padrão',
        };
    }

    /**
     * Seleciona o melhor modelo baseado na complexidade da query
     * (Token-saving strategy - 2024-2025 best practice)
     */
    selectOptimalModel(provider: AIProvider, prompt: string): ModelConfig {
        const chain = this.defaultChains[provider];
        if (!chain) {
            throw new Error(`Nenhuma cadeia configurada para ${provider}`);
        }

        const complexity = this.classifyQuery(prompt);
        console.log(`[ModelFallbackManager] 🎯 Query classificada como: ${complexity.isSimple ? 'SIMPLES' : 'COMPLEXA'} (confiança: ${complexity.confidence})`);
        console.log(`[ModelFallbackManager] 📝 Razão: ${complexity.reasoning}`);

        // Para queries simples, usar modelo mais barato/rápido se disponível
        if (complexity.isSimple && complexity.confidence > 0.7) {
            // Tentar usar modelo secundário (mais barato) para queries simples
            if (chain.secondary && !this.isQuotaExceeded(chain.secondary.provider, chain.secondary.model)) {
                console.log(`[ModelFallbackManager] 💰 Usando modelo econômico para query simples: ${chain.secondary.model}`);
                return chain.secondary;
            }
        }

        // Para queries complexas ou quando não há certeza, usar modelo primário
        if (!this.isQuotaExceeded(chain.primary.provider, chain.primary.model)) {
            return chain.primary;
        }

        // Se primário está com quota excedida, tentar secundário
        if (chain.secondary && !this.isQuotaExceeded(chain.secondary.provider, chain.secondary.model)) {
            console.log(`[ModelFallbackManager] ⚠️ Modelo primário com quota excedida, usando secundário`);
            return chain.secondary;
        }

        // Último recurso: terciário
        if (chain.tertiary && !this.isQuotaExceeded(chain.tertiary.provider, chain.tertiary.model)) {
            console.log(`[ModelFallbackManager] ⚠️ Modelos primário e secundário com quota excedida, usando terciário`);
            return chain.tertiary;
        }

        // Se tudo falhou, retornar primário e deixar o erro acontecer
        console.warn(`[ModelFallbackManager] ❌ Todos os modelos com quota excedida, tentando primário mesmo assim`);
        return chain.primary;
    }

    /**
     * Comprime um prompt para economizar tokens (2024-2025 best practice)
     * Usado quando fazendo fallback para modelos com limites menores
     */
    compressPrompt(prompt: string, maxLength: number = 500): string {
        if (prompt.length <= maxLength) {
            return prompt;
        }

        console.log(`[ModelFallbackManager] ✂️ Comprimindo prompt de ${prompt.length} para ~${maxLength} caracteres`);

        // Estratégias de compressão:
        // 1. Remover espaços extras
        let compressed = prompt.replace(/\s+/g, ' ').trim();

        // 2. Se ainda muito grande, pegar início + fim
        if (compressed.length > maxLength) {
            const halfLength = Math.floor(maxLength / 2) - 20;
            compressed = compressed.substring(0, halfLength) +
                '\n[...conteúdo resumido...]\n' +
                compressed.substring(compressed.length - halfLength);
        }

        console.log(`[ModelFallbackManager] ✅ Prompt comprimido: ${compressed.length} caracteres`);
        return compressed;
    }

    /**
     * Monitor de reset de quotas (roda a cada hora)
     */
    private startQuotaResetMonitor(): void {
        setInterval(() => {
            const now = new Date();
            let resetCount = 0;

            for (const [key, status] of this.quotaStatus.entries()) {
                if (status.resetAt && now > status.resetAt) {
                    this.quotaStatus.delete(key);
                    resetCount++;
                    console.log(`[ModelFallbackManager] 🔄 Quota resetada automaticamente: ${key}`);
                }
            }

            if (resetCount > 0) {
                console.log(`[ModelFallbackManager] ✅ ${resetCount} quota(s) resetada(s)`);
            }
        }, 60 * 60 * 1000); // A cada 1 hora
    }

    /**
     * Obtém estatísticas de quota
     */
    getQuotaStats(): { total: number; exceeded: number; available: number } {
        const exceeded = Array.from(this.quotaStatus.values()).filter(s => s.isExceeded).length;
        const total = Object.keys(this.defaultChains).reduce((acc, provider) => {
            const chain = this.defaultChains[provider as AIProvider];
            return acc + (chain.tertiary ? 3 : chain.secondary ? 2 : 1);
        }, 0);

        return {
            total,
            exceeded,
            available: total - exceeded,
        };
    }
}

// Singleton instance
export const modelFallbackManager = new ModelFallbackManager();
