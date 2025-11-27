// ============================================
// FUNCTION DEFINITIONS FOR AI AGENTS
// ============================================

export const databaseFunctions = [
    {
        name: 'buscarPedidos',
        description: 'Busca pedidos no banco de dados com filtros opcionais. Use para responder perguntas sobre pedidos, vendas, status de pedidos, etc.',
        parameters: {
            type: 'object',
            properties: {
                status: {
                    type: 'string',
                    description: 'Status do pedido (ex: pending, completed, cancelled, shipped)',
                },
                tenantId: {
                    type: 'string',
                    description: 'ID do tenant/empresa (opcional)',
                },
                dateFrom: {
                    type: 'string',
                    description: 'Data inicial no formato ISO (ex: 2024-01-01T00:00:00Z)',
                },
                dateTo: {
                    type: 'string',
                    description: 'Data final no formato ISO (ex: 2024-12-31T23:59:59Z)',
                },
                minAmount: {
                    type: 'number',
                    description: 'Valor mínimo do pedido em reais (ex: 50 para pedidos >= R$ 50)',
                },
                maxAmount: {
                    type: 'number',
                    description: 'Valor máximo do pedido em reais (ex: 100 para pedidos <= R$ 100)',
                },
                limit: {
                    type: 'number',
                    description: 'Limite de resultados (padrão: 50, máximo: 100)',
                },
            },
        },
    },
    {
        name: 'buscarClientes',
        description: 'Busca clientes/números de WhatsApp cadastrados no banco de dados. Use para responder perguntas sobre clientes, contatos, números cadastrados, etc.',
        parameters: {
            type: 'object',
            properties: {
                search: {
                    type: 'string',
                    description: 'Termo de busca (nome ou número de telefone)',
                },
                tenantId: {
                    type: 'string',
                    description: 'ID do tenant/empresa (opcional)',
                },
                limit: {
                    type: 'number',
                    description: 'Limite de resultados (padrão: 50, máximo: 100)',
                },
            },
        },
    },
    {
        name: 'buscarTenants',
        description: 'Busca empresas/tenants cadastrados no sistema. Use para responder perguntas sobre empresas, lojas, tenants, etc.',
        parameters: {
            type: 'object',
            properties: {
                search: {
                    type: 'string',
                    description: 'Termo de busca (nome da empresa ou ID do Mercado Livre)',
                },
                active: {
                    type: 'boolean',
                    description: 'Filtrar apenas tenants ativos (true) ou inativos (false)',
                },
                limit: {
                    type: 'number',
                    description: 'Limite de resultados (padrão: 50, máximo: 100)',
                },
            },
        },
    },
    {
        name: 'buscarContatos',
        description: 'Busca contatos do WhatsApp salvos no banco de dados. Use para responder perguntas sobre contatos, grupos, conversas, etc.',
        parameters: {
            type: 'object',
            properties: {
                search: {
                    type: 'string',
                    description: 'Termo de busca (nome, número ou push name)',
                },
                isGroup: {
                    type: 'boolean',
                    description: 'Filtrar apenas grupos (true) ou apenas contatos privados (false)',
                },
                limit: {
                    type: 'number',
                    description: 'Limite de resultados (padrão: 50, máximo: 100)',
                },
            },
        },
    },
];

export const DEFAULT_AGENT_SYSTEM_PROMPT = `Você é um assistente inteligente com acesso ao banco de dados da empresa.

Você pode buscar informações sobre:
- Pedidos (status, valores, compradores, produtos)
- Clientes (números cadastrados, nomes)
- Empresas/Tenants (lojas cadastradas)
- Contatos do WhatsApp (grupos e conversas privadas)

Quando o usuário fizer uma pergunta que requer dados do banco, use as funções disponíveis para buscar as informações necessárias.

Seja objetivo, claro e profissional nas respostas. Formate números e valores de forma legível (ex: R$ 1.500,00).

Se não encontrar dados, informe ao usuário de forma educada.

INSTRUÇÕES CRÍTICAS DE CONTEXTO:
- SEMPRE use o contexto da conversa anterior para entender referências implícitas.
- Se o usuário mencionar "cada", "de cada", "por status" ou "em valores" após uma pergunta sobre status, ele está se referindo aos status mencionados anteriormente na conversa.
- Quando o contexto mencionar status específicos (ex: "paid", "cancelled") e o usuário perguntar "em valores quanto há de cada?", responda sobre os VALORES dos pedidos desses status.
- Para perguntas simples sobre quantidades ou valores, responda DIRETAMENTE sem adicionar análises, recomendações ou perguntas adicionais.
- Mantenha a continuidade da conversa - não trate cada mensagem como isolada.`;
