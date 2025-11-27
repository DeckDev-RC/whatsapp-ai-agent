import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { FileText, RefreshCw, Code } from 'lucide-react';

// ============================================
// SYSTEM PROMPT VIEW PAGE
// ============================================

interface FunctionDefinition {
  name: string;
  description: string;
  parameters: {
    type: string;
    properties: Record<string, {
      type: string;
      description: string;
    }>;
  };
}

interface SystemPromptData {
  systemPrompt: string;
  functionDefinitions: FunctionDefinition[];
}

export function SystemPromptView() {
  const [prompt, setPrompt] = useState<string>('');
  const [functions, setFunctions] = useState<FunctionDefinition[]>([]);
  const [loading, setLoading] = useState(true);

  const loadPrompt = async () => {
    setLoading(true);
    try {
      const response = await window.api.systemPrompt.get();
      if (response.success && response.data) {
        // Type guard to ensure data has the correct structure
        const data = response.data as unknown as SystemPromptData;
        setPrompt(data.systemPrompt || '');
        setFunctions(data.functionDefinitions || []);
      }
    } catch (error) {
      console.error('Erro ao carregar prompt:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPrompt();
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            System Prompt
          </h1>
          <p className="text-text-secondary">
            Visualização do prompt system interno do agente
          </p>
        </div>
        <button
          onClick={loadPrompt}
          disabled={loading}
          className="btn-secondary flex items-center gap-2"
          title="Atualizar prompt"
        >
          <RefreshCw className={`w-5 h-5 ${loading ? 'animate-spin' : ''}`} />
          Atualizar
        </button>
      </div>

      {/* Prompt Display */}
      <GlassCard>
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-5 h-5 text-accent" />
          <h2 className="text-xl font-semibold text-text-primary">
            Prompt System Interno
          </h2>
        </div>

        {loading ? (
          <div className="text-center py-8">
            <RefreshCw className="w-8 h-8 text-accent animate-spin mx-auto mb-2" />
            <p className="text-text-secondary">Carregando prompt...</p>
          </div>
        ) : (
          <div className="bg-black/20 rounded-lg p-4 border border-white/10">
            <pre className="text-sm text-text-primary whitespace-pre-wrap font-mono leading-relaxed">
              {prompt || 'Nenhum prompt encontrado'}
            </pre>
          </div>
        )}
      </GlassCard>

      {/* Function Definitions Display */}
      {functions.length > 0 && (
        <GlassCard>
          <div className="flex items-center gap-2 mb-4">
            <Code className="w-5 h-5 text-accent" />
            <h2 className="text-xl font-semibold text-text-primary">
              Definições de Funções
            </h2>
          </div>

          <div className="space-y-4">
            {functions.map((func, index) => (
              <div
                key={index}
                className="bg-black/20 rounded-lg p-4 border border-white/10"
              >
                <div className="mb-3">
                  <h3 className="text-lg font-semibold text-accent mb-1">
                    {func.name}
                  </h3>
                  <p className="text-sm text-text-secondary">
                    {func.description}
                  </p>
                </div>

                {func.parameters && func.parameters.properties && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <h4 className="text-sm font-medium text-text-primary mb-2">
                      Parâmetros:
                    </h4>
                    <div className="space-y-2">
                      {Object.entries(func.parameters.properties).map(([paramName, paramDef]) => (
                        <div key={paramName} className="text-sm">
                          <span className="text-accent font-mono">{paramName}</span>
                          <span className="text-text-secondary mx-2">({paramDef.type})</span>
                          <span className="text-text-secondary">- {paramDef.description}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
    </div>
  );
}

