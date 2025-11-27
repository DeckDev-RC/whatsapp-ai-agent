import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { Activity, Search, Trash2, RefreshCw, Database, Zap } from 'lucide-react';

// ============================================
// RAG DIAGNOSTIC VIEW PAGE
// ============================================

interface RAGStats {
    totalEmbeddings: number;
    initializedTenants: string[];
}

interface SearchResult {
    order: {
        id: string;
        external_order_id: string;
        status: string;
        marketplace: string;
        total_amount: number;
        tenant_id: string;
    };
    score: number;
}

export function RAGDiagnosticView() {
    const [stats, setStats] = useState<RAGStats | null>(null);
    const [loading, setLoading] = useState(true);
    const [searchQuery, setSearchQuery] = useState('');
    const [searchTenantId, setSearchTenantId] = useState('');
    const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
    const [searching, setSearching] = useState(false);
    const [tenants, setTenants] = useState<any[]>([]);

    const loadStats = async () => {
        setLoading(true);
        try {
            const response = await window.api.rag.getStats();
            if (response.success && response.data) {
                setStats(response.data);
            }
        } catch (error) {
            console.error('Erro ao carregar stats do RAG:', error);
        } finally {
            setLoading(false);
        }
    };

    const loadTenants = async () => {
        try {
            const response = await window.api.tenant.getAll();
            if (response.success && response.data) {
                setTenants(response.data);
            }
        } catch (error) {
            console.error('Erro ao carregar tenants:', error);
        }
    };

    const handleSearch = async () => {
        if (!searchQuery.trim() || !searchTenantId) {
            return;
        }

        setSearching(true);
        try {
            const response = await window.api.rag.testSearch(searchQuery, searchTenantId, 5);
            if (response.success && response.data) {
                setSearchResults(response.data);
            }
        } catch (error) {
            console.error('Erro ao buscar:', error);
        } finally {
            setSearching(false);
        }
    };

    const handleClearCache = async (tenantId: string) => {
        if (!confirm(`Tem certeza que deseja limpar o cache de embeddings do tenant ${tenantId}?`)) {
            return;
        }

        try {
            const response = await window.api.rag.clearCache(tenantId);
            if (response.success) {
                alert('Cache limpo com sucesso!');
                loadStats();
            }
        } catch (error) {
            console.error('Erro ao limpar cache:', error);
            alert('Erro ao limpar cache');
        }
    };

    useEffect(() => {
        loadStats();
        loadTenants();
    }, []);

    return (
        <div className="space-y-6 animate-fade-in">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-bold text-text-primary mb-2">
                        RAG Diagnóstico
                    </h1>
                    <p className="text-text-secondary">
                        Monitoramento do sistema de busca vetorial (RAG) e embeddings
                    </p>
                </div>
                <button
                    onClick={loadStats}
                    disabled={loading}
                    className="btn-secondary flex items-center gap-2"
                    title="Atualizar estatísticas"
                >
                    <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
                    Atualizar
                </button>
            </div>

            {/* Statistics Card */}
            <GlassCard>
                <div className="flex items-center gap-2 mb-4">
                    <Activity className="w-5 h-5 text-accent" />
                    <h2 className="text-xl font-semibold text-text-primary">
                        Estatísticas do RAG
                    </h2>
                </div>

                {loading ? (
                    <div className="text-center py-8">
                        <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-2" />
                        <p className="text-text-secondary">Carregando estatísticas...</p>
                    </div>
                ) : stats ? (
                    <div className="space-y-4">
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Database className="w-5 h-5 text-accent" />
                                    <h3 className="text-sm font-medium text-text-secondary">Total de Embeddings</h3>
                                </div>
                                <p className="text-3xl font-bold text-text-primary">{stats.totalEmbeddings}</p>
                            </div>

                            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                                <div className="flex items-center gap-2 mb-2">
                                    <Zap className="w-5 h-5 text-accent" />
                                    <h3 className="text-sm font-medium text-text-secondary">Tenants Inicializados</h3>
                                </div>
                                <p className="text-3xl font-bold text-text-primary">{stats.initializedTenants.length}</p>
                            </div>
                        </div>

                        {stats.initializedTenants.length > 0 && (
                            <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                                <h3 className="text-sm font-medium text-text-secondary mb-3">Tenants com Embeddings</h3>
                                <div className="space-y-2">
                                    {stats.initializedTenants.map((tenantId) => {
                                        const tenant = tenants.find(t => t.id === tenantId);
                                        return (
                                            <div key={tenantId} className="flex items-center justify-between bg-black/30 rounded p-3">
                                                <div>
                                                    <p className="text-text-primary font-medium">{tenant?.name || tenantId}</p>
                                                    <p className="text-xs text-text-secondary">{tenantId}</p>
                                                </div>
                                                <button
                                                    onClick={() => handleClearCache(tenantId)}
                                                    className="btn-secondary-sm flex items-center gap-1"
                                                    title="Limpar cache deste tenant"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                    Limpar Cache
                                                </button>
                                            </div>
                                        );
                                    })}
                                </div>
                            </div>
                        )}
                    </div>
                ) : (
                    <p className="text-text-secondary text-center py-4">Nenhuma estatística disponível</p>
                )}
            </GlassCard>

            {/* Test Search Card */}
            <GlassCard>
                <div className="flex items-center gap-2 mb-4">
                    <Search className="w-5 h-5 text-accent" />
                    <h2 className="text-xl font-semibold text-text-primary">
                        Teste de Busca RAG
                    </h2>
                </div>

                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Tenant
                            </label>
                            <select
                                value={searchTenantId}
                                onChange={(e) => setSearchTenantId(e.target.value)}
                                className="input w-full"
                            >
                                <option value="">Selecione um tenant</option>
                                {tenants.map((tenant) => (
                                    <option key={tenant.id} value={tenant.id}>
                                        {tenant.name}
                                    </option>
                                ))}
                            </select>
                        </div>

                        <div>
                            <label className="block text-sm font-medium text-text-secondary mb-2">
                                Query de Busca
                            </label>
                            <input
                                type="text"
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
                                placeholder="Ex: pedidos pendentes"
                                className="input w-full"
                            />
                        </div>
                    </div>

                    <button
                        onClick={handleSearch}
                        disabled={searching || !searchQuery.trim() || !searchTenantId}
                        className="btn-primary flex items-center gap-2"
                    >
                        <Search className={`w-5 h-5 ${searching ? 'animate-pulse' : ''}`} />
                        {searching ? 'Buscando...' : 'Buscar'}
                    </button>

                    {searchResults.length > 0 && (
                        <div className="mt-6">
                            <h3 className="text-lg font-semibold text-text-primary mb-3">
                                Resultados ({searchResults.length})
                            </h3>
                            <div className="space-y-3">
                                {searchResults.map((result, index) => (
                                    <div key={index} className="bg-black/20 rounded-lg p-4 border border-white/10">
                                        <div className="flex items-start justify-between mb-2">
                                            <div>
                                                <p className="text-text-primary font-medium">
                                                    Pedido #{result.order.external_order_id}
                                                </p>
                                                <p className="text-sm text-text-secondary">
                                                    {result.order.marketplace} • {result.order.status}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-accent font-bold">
                                                    {(result.score * 100).toFixed(1)}%
                                                </p>
                                                <p className="text-xs text-text-secondary">relevância</p>
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-4 text-sm text-text-secondary">
                                            <span>Valor: R$ {result.order.total_amount.toFixed(2)}</span>
                                            <span>ID: {result.order.id}</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {searchResults.length === 0 && searchQuery && !searching && (
                        <div className="text-center py-8 bg-black/20 rounded-lg border border-white/10">
                            <p className="text-text-secondary">Nenhum resultado encontrado</p>
                        </div>
                    )}
                </div>
            </GlassCard>

            {/* How to Verify Card */}
            <GlassCard>
                <h2 className="text-xl font-semibold text-text-primary mb-4">
                    Como Verificar se o RAG Está Funcionando
                </h2>
                <div className="space-y-3 text-sm text-text-secondary">
                    <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                        <h3 className="text-text-primary font-medium mb-2">1. Verificar pelos Logs do Console</h3>
                        <p>Abra o DevTools (Ctrl+Shift+I) e procure por:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1 font-mono text-xs">
                            <li>[RAGManager] Inicializando embeddings...</li>
                            <li>[RAGManager] ✅ Embeddings inicializados para X orders</li>
                            <li>[MessageProcessor] 🎯 RAG encontrou X orders relevantes</li>
                        </ul>
                    </div>

                    <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                        <h3 className="text-text-primary font-medium mb-2">2. Verificar pelas Estatísticas</h3>
                        <p>Se o RAG está funcionando:</p>
                        <ul className="list-disc list-inside mt-2 space-y-1">
                            <li>Total de Embeddings deve ser maior que 0</li>
                            <li>Deve haver pelo menos 1 tenant inicializado</li>
                        </ul>
                    </div>

                    <div className="bg-black/20 rounded-lg p-4 border border-white/10">
                        <h3 className="text-text-primary font-medium mb-2">3. Testar Busca Manual</h3>
                        <p>Use o formulário acima para testar uma busca. Se retornar resultados com scores &gt; 0.1, o RAG está funcionando!</p>
                    </div>
                </div>
            </GlassCard>
        </div>
    );
}
