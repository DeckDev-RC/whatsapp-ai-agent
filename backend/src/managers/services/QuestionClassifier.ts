// ============================================
// QUESTION CLASSIFIER - RAG Integration
// ============================================
// Classifica perguntas para decidir entre RAG, cálculo direto ou híbrido

export type QueryType = 'CALCULATION' | 'SEMANTIC_SEARCH' | 'HYBRID' | 'CONVERSATIONAL';

export interface ClassificationResult {
    type: QueryType;
    confidence: number;
    reason: string;
    useRAG: boolean;
    useCalculation: boolean;
}

export class QuestionClassifier {
    /**
     * Classifica uma pergunta para determinar a melhor abordagem
     */
    classify(message: string): ClassificationResult {
        const messageLower = message.toLowerCase().trim();

        // 1. CONVERSATIONAL - Saudações e perguntas simples
        if (this.isConversational(messageLower)) {
            return {
                type: 'CONVERSATIONAL',
                confidence: 0.95,
                reason: 'Mensagem conversacional detectada',
                useRAG: false,
                useCalculation: false,
            };
        }

        // 2. CALCULATION - Perguntas sobre estatísticas/cálculos
        if (this.isCalculationQuery(messageLower)) {
            return {
                type: 'CALCULATION',
                confidence: 0.9,
                reason: 'Pergunta sobre cálculos/estatísticas detectada',
                useRAG: false,
                useCalculation: true,
            };
        }

        // 3. SEMANTIC_SEARCH - Perguntas que requerem busca semântica
        if (this.isSemanticQuery(messageLower)) {
            return {
                type: 'SEMANTIC_SEARCH',
                confidence: 0.85,
                reason: 'Pergunta semântica detectada',
                useRAG: true,
                useCalculation: false,
            };
        }

        // 4. HYBRID - Combinar RAG + Cálculo
        if (this.isHybridQuery(messageLower)) {
            return {
                type: 'HYBRID',
                confidence: 0.8,
                reason: 'Pergunta complexa requer RAG + cálculos',
                useRAG: true,
                useCalculation: true,
            };
        }

        // Default: usar RAG para perguntas abertas
        return {
            type: 'SEMANTIC_SEARCH',
            confidence: 0.6,
            reason: 'Pergunta aberta - usando RAG por padrão',
            useRAG: true,
            useCalculation: false,
        };
    }

    /**
     * Detecta mensagens conversacionais (saudações, agradecimentos)
     */
    private isConversational(message: string): boolean {
        const conversationalPatterns = [
            /^(oi|olá|ola|hey|hi|hello)$/,
            /^(obrigad|valeu|thanks|thank you)/,
            /^(tchau|até|bye|adeus)/,
            /^(bom dia|boa tarde|boa noite)/,
            /^(tudo bem|como vai|tá bem)/,
        ];

        return conversationalPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Detecta perguntas sobre cálculos/estatísticas
     */
    private isCalculationQuery(message: string): boolean {
        const calculationKeywords = [
            // Médias
            'ticket médio', 'ticket medio', 'média', 'media', 'average',

            // Totais
            'total', 'soma', 'somar', 'quanto', 'quantos', 'quantas',

            // Contagens
            'quantidade', 'número', 'numero', 'count',

            // Valores
            'valor total', 'faturamento', 'receita',

            // Percentuais
            'percentual', 'porcentagem', '%',

            // Por status
            'por status', 'cada status', 'status',
        ];

        return calculationKeywords.some(keyword => message.includes(keyword));
    }

    /**
     * Detecta perguntas que requerem busca semântica
     */
    private isSemanticQuery(message: string): boolean {
        const semanticKeywords = [
            // Problemas
            'problema', 'erro', 'falha', 'defeito', 'reclamação', 'reclamacao',

            // Atrasos
            'atrasado', 'atraso', 'pendente', 'aguardando',

            // Busca específica
            'encontre', 'encontrar', 'busque', 'buscar', 'procure', 'procurar',
            'mostre', 'mostrar', 'liste', 'listar',

            // Qualitativo
            'quais', 'qual', 'que', 'onde',

            // Cliente específico
            'cliente', 'comprador', 'usuário', 'usuario',

            // Produto específico
            'produto', 'item', 'artigo',
        ];

        // Se tem palavra-chave semântica E não é cálculo puro
        const hasSemanticKeyword = semanticKeywords.some(keyword => message.includes(keyword));
        const isNotPureCalculation = !this.isPureCalculation(message);

        return hasSemanticKeyword && isNotPureCalculation;
    }

    /**
     * Detecta perguntas híbridas (RAG + Cálculo)
     */
    private isHybridQuery(message: string): boolean {
        const hybridPatterns = [
            // Análise + cálculo
            /analise.*total/,
            /analise.*valor/,
            /analise.*quantidade/,

            // Por que + número
            /por que.*total/,
            /por que.*valor/,
            /porque.*total/,

            // Comparação
            /comparar.*com/,
            /diferença.*entre/,
            /diferenca.*entre/,

            // Tendência
            /tendência/,
            /tendencia/,
            /crescimento/,
            /queda/,
            /aumentou/,
            /diminuiu/,
        ];

        return hybridPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Verifica se é um cálculo puro (sem contexto semântico)
     */
    private isPureCalculation(message: string): boolean {
        // Perguntas muito curtas com apenas números/cálculos
        const pureCalculationPatterns = [
            /^(qual|quanto|quantos|quantas)\s+(o|a|os|as)?\s*(total|valor|quantidade|média|media)/,
            /^(total|valor|quantidade|média|media)\s+(de|dos|das)?/,
        ];

        return pureCalculationPatterns.some(pattern => pattern.test(message));
    }

    /**
     * Determina se deve usar RAG baseado na classificação
     */
    shouldUseRAG(classification: ClassificationResult): boolean {
        return classification.useRAG;
    }

    /**
     * Determina se deve usar cálculo direto baseado na classificação
     */
    shouldUseCalculation(classification: ClassificationResult): boolean {
        return classification.useCalculation;
    }
}

export const questionClassifier = new QuestionClassifier();
