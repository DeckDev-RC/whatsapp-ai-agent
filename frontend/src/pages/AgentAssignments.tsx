import { useState } from 'react';
import { GlassCard, GlassCardHeader } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import {
  MessageSquare,
  User,
  Bot,
  Link,
  Unlink,
  RefreshCw,
  Loader2,
  Search,
  Download,
  Users,
} from 'lucide-react';
import { showNotification } from '../components/Notification';
import { useAppStore, forceRefresh } from '../store/appStore';

// ============================================
// AGENT ASSIGNMENTS PAGE
// ============================================

type TabType = 'groups' | 'private';

export function AgentAssignments() {
  const {
    agents,
    agentAssignments,
    whatsappContacts,
    whatsapp,
    agentsLoading,
    assignmentsLoading,
    contactsLoading,
    syncWhatsAppContacts,
  } = useAppStore();

  const [activeTab, setActiveTab] = useState<TabType>('groups');
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedContact, setSelectedContact] = useState<string | null>(null);
  const [selectedAgent, setSelectedAgent] = useState<string>('');
  const [syncing, setSyncing] = useState(false);

  const activeAgents = agents.filter(a => a.isActive);
  const contacts = whatsappContacts || [];

  // Separar grupos e conversas privadas
  const groups = contacts.filter(c => c.phone.includes('@g.us'));
  const privateChats = contacts.filter(c => !c.phone.includes('@g.us'));

  const getAssignedAgent = (contactPhone: string) => {
    return agentAssignments.find((a) => a.contactPhone === contactPhone);
  };

  const getAgentById = (agentId: string) => {
    return agents.find((a) => a.id === agentId);
  };

  const handleAssign = async () => {
    if (!selectedContact || !selectedAgent) {
      showNotification('warning', 'Selecione um contato e um agente');
      return;
    }

    try {
      const contact = contacts.find((c) => c.phone === selectedContact);
      const response = await window.api.agent.assignToContact(
        selectedAgent,
        selectedContact,
        contact?.name
      );

      if (response.success) {
        showNotification('success', '✅ Agente atribuído!');
        setSelectedContact(null);
        setSelectedAgent('');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Erro ao atribuir agente:', error);
      showNotification('error', 'Erro ao atribuir agente');
    }
  };

  const handleRemoveAssignment = async (contactPhone: string) => {
    if (!confirm('Tem certeza que deseja remover esta atribuição?')) {
      return;
    }

    try {
      const response = await window.api.agent.removeAssignmentByContact(contactPhone);
      if (response.success) {
        showNotification('success', 'Atribuição removida');
        forceRefresh();
      } else {
        showNotification('error', `Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Erro ao remover atribuição:', error);
      showNotification('error', 'Erro ao remover atribuição');
    }
  };

  const sortContacts = (contactsList: typeof contacts) => {
    // Filtra por busca
    const filtered = contactsList.filter((contact) => {
      const searchLower = searchTerm.toLowerCase();
      return (
        contact.phone.includes(searchLower) ||
        contact.name?.toLowerCase().includes(searchLower)
      );
    });

    // Ordena: com atribuição primeiro
    return filtered.sort((a, b) => {
      const aHasAgent = !!getAssignedAgent(a.phone);
      const bHasAgent = !!getAssignedAgent(b.phone);

      if (aHasAgent && !bHasAgent) return -1;
      if (!aHasAgent && bHasAgent) return 1;

      // Se ambos têm ou não têm agente, ordena por nome
      return (a.name || '').localeCompare(b.name || '');
    });
  };

  const handleSyncContacts = async () => {
    if (!whatsapp?.isConnected) {
      showNotification('warning', 'WhatsApp não está conectado');
      return;
    }

    setSyncing(true);
    try {
      const result = await syncWhatsAppContacts();
      if (result.synced > 0) {
        showNotification('success', `✅ ${result.synced} contatos sincronizados!`);
        forceRefresh();
      } else {
        showNotification('warning', 'Nenhum contato novo encontrado');
      }
    } catch (error) {
      console.error('Erro ao sincronizar contatos:', error);
      showNotification('error', 'Erro ao sincronizar contatos');
    } finally {
      setSyncing(false);
    }
  };

  const renderContactCard = (contact: typeof contacts[0]) => {
    const assignment = getAssignedAgent(contact.phone);
    const agent = assignment ? getAgentById(assignment.agentId) : undefined;
    const isGroup = contact.phone.includes('@g.us');

    return (
      <GlassCard key={contact.phone}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4 flex-1">
            <div className={`w-12 h-12 rounded-xl ${isGroup ? 'bg-purple-500/20' : 'bg-blue-500/20'} flex items-center justify-center flex-shrink-0`}>
              {isGroup ? (
                <Users className="w-6 h-6 text-purple-400" />
              ) : (
                <User className="w-6 h-6 text-blue-400" />
              )}
            </div>

            <div className="flex-1">
              <div className="flex items-center gap-3 mb-1">
                <h3 className="text-lg font-semibold text-text-primary">
                  {contact.name || 'Sem nome'}
                </h3>
                {agent ? (
                  <StatusBadge status="success" label="Com Agente" animate />
                ) : (
                  <StatusBadge status="warning" label="Sem Agente" />
                )}
                {isGroup && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400 border border-purple-500/30">
                    Grupo
                  </span>
                )}
              </div>
              <p className="text-sm text-text-secondary font-mono">{contact.phone}</p>
              {contact.lastMessage && (
                <p className="text-xs text-text-secondary mt-1 italic line-clamp-1">
                  "{contact.lastMessage}"
                </p>
              )}
            </div>

            {agent && (
              <div className="p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-lg">
                <div className="flex items-center gap-2 mb-1">
                  <Bot className="w-4 h-4 text-emerald-400" />
                  <span className="text-sm font-medium text-emerald-400">Agente Atribuído</span>
                </div>
                <p className="text-text-primary font-semibold">{agent.name}</p>
                <p className="text-xs text-text-secondary">
                  {agent.provider} - {agent.model}
                </p>
              </div>
            )}
          </div>

          <div className="flex gap-2 ml-4">
            {agent ? (
              <button
                onClick={() => handleRemoveAssignment(contact.phone)}
                className="btn-secondary bg-red-500/20 hover:bg-red-500/30"
              >
                <Unlink className="w-4 h-4 inline mr-2" />
                Remover
              </button>
            ) : (
              <button
                onClick={() => {
                  setSelectedContact(contact.phone);
                  setSelectedAgent('');
                }}
                className="btn-primary"
                disabled={activeAgents.length === 0}
              >
                <Link className="w-4 h-4 inline mr-2" />
                Atribuir Agente
              </button>
            )}
          </div>
        </div>
      </GlassCard>
    );
  };

  const loading = agentsLoading || assignmentsLoading || contactsLoading;

  if (loading && contacts.length === 0) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="w-8 h-8 animate-spin text-accent" />
      </div>
    );
  }

  const sortedGroups = sortContacts(groups);
  const sortedPrivateChats = sortContacts(privateChats);
  const currentContacts = activeTab === 'groups' ? sortedGroups : sortedPrivateChats;

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Atribuições de Agentes
          </h1>
          <p className="text-text-secondary">
            Vincule agentes a conversas do WhatsApp para atendimento automático
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={handleSyncContacts}
            disabled={!whatsapp?.isConnected || syncing}
            className="btn-secondary flex items-center gap-2"
            title="Sincronizar contatos do WhatsApp"
          >
            {syncing ? (
              <Loader2 className="w-5 h-5 animate-spin" />
            ) : (
              <Download className="w-5 h-5" />
            )}
            Sincronizar Contatos
          </button>
          <button
            onClick={forceRefresh}
            className="btn-secondary flex items-center gap-2"
            title="Atualizar"
          >
            <RefreshCw className="w-5 h-5" />
            Atualizar
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <GlassCard className="bg-gradient-to-br from-blue-500/10 to-purple-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-500/20 flex items-center justify-center">
              <Bot className="w-6 h-6 text-blue-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{activeAgents.length || 0}</p>
              <p className="text-sm text-text-secondary">Agentes Ativos</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-gradient-to-br from-emerald-500/10 to-green-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-emerald-500/20 flex items-center justify-center">
              <Link className="w-6 h-6 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{agentAssignments.length || 0}</p>
              <p className="text-sm text-text-secondary">Conversas Atribuídas</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-gradient-to-br from-purple-500/10 to-pink-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-purple-500/20 flex items-center justify-center">
              <Users className="w-6 h-6 text-purple-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{groups.length || 0}</p>
              <p className="text-sm text-text-secondary">Grupos</p>
            </div>
          </div>
        </GlassCard>

        <GlassCard className="bg-gradient-to-br from-orange-500/10 to-red-500/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center">
              <User className="w-6 h-6 text-orange-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-text-primary">{privateChats.length || 0}</p>
              <p className="text-sm text-text-secondary">Conversas Privadas</p>
            </div>
          </div>
        </GlassCard>
      </div>

      {/* Assign Form */}
      {selectedContact && (
        <GlassCard className="bg-gradient-to-r from-purple-500/10 to-blue-500/10 border-purple-500/30">
          <GlassCardHeader title="Atribuir Agente" />
          <div className="mt-4 space-y-4">
            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Contato Selecionado
              </label>
              <div className="p-3 bg-white/5 rounded-lg">
                <p className="text-text-primary font-medium">
                  {contacts.find((c) => c.phone === selectedContact)?.name || 'Sem nome'}
                </p>
                <p className="text-text-secondary text-sm font-mono">{selectedContact}</p>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-text-primary mb-2">
                Selecione o Agente
              </label>
              <select
                value={selectedAgent}
                onChange={(e) => setSelectedAgent(e.target.value)}
                className="glass-select"
              >
                <option value="">Escolha um agente...</option>
                {activeAgents.map((agent) => (
                  <option key={agent.id} value={agent.id}>
                    {agent.name} - {agent.provider} ({agent.model})
                  </option>
                ))}
              </select>
            </div>

            <div className="flex gap-3">
              <button onClick={handleAssign} className="btn-primary flex-1" disabled={!selectedAgent}>
                <Link className="w-4 h-4 inline mr-2" />
                Atribuir Agente
              </button>
              <button
                onClick={() => {
                  setSelectedContact(null);
                  setSelectedAgent('');
                }}
                className="btn-secondary flex-1"
              >
                Cancelar
              </button>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-4 border-b border-white/10">
        <button
          onClick={() => setActiveTab('groups')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'groups'
              ? 'border-purple-500 text-purple-400'
              : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
        >
          <Users className="w-5 h-5" />
          <span className="font-medium">Grupos</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-purple-500/20 text-purple-400">
            {groups.length}
          </span>
        </button>

        <button
          onClick={() => setActiveTab('private')}
          className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors ${activeTab === 'private'
              ? 'border-blue-500 text-blue-400'
              : 'border-transparent text-text-secondary hover:text-text-primary'
            }`}
        >
          <User className="w-5 h-5" />
          <span className="font-medium">Conversas Privadas</span>
          <span className="text-xs px-2 py-0.5 rounded-full bg-blue-500/20 text-blue-400">
            {privateChats.length}
          </span>
        </button>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-text-secondary" />
        <input
          type="text"
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          placeholder={`Buscar ${activeTab === 'groups' ? 'grupo' : 'conversa'} por nome ou número...`}
          className="glass-input pl-10"
        />
      </div>

      {/* WhatsApp not connected warning */}
      {!whatsapp?.isConnected && (
        <GlassCard className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
          <div className="flex items-start gap-4">
            <div className="w-12 h-12 rounded-xl bg-orange-500/20 flex items-center justify-center flex-shrink-0">
              <MessageSquare className="w-6 h-6 text-orange-400" />
            </div>
            <div className="flex-1">
              <h3 className="text-lg font-semibold text-orange-400 mb-2">
                WhatsApp não conectado
              </h3>
              <p className="text-sm text-text-secondary">
                Conecte o WhatsApp para sincronizar e visualizar seus contatos. Vá para a página "WhatsApp" para fazer a conexão.
              </p>
            </div>
          </div>
        </GlassCard>
      )}

      {/* Conversations List */}
      <div className="space-y-4">
        {currentContacts.length === 0 ? (
          <GlassCard>
            <div className="text-center py-12">
              {activeTab === 'groups' ? (
                <Users className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              ) : (
                <User className="w-16 h-16 text-text-secondary mx-auto mb-4 opacity-50" />
              )}
              <p className="text-text-secondary text-lg">
                Nenhum{activeTab === 'groups' ? ' grupo' : 'a conversa'} encontrad{activeTab === 'groups' ? 'o' : 'a'}
              </p>
              {whatsapp?.isConnected && (
                <p className="text-text-secondary text-sm mt-2">
                  {searchTerm
                    ? 'Tente buscar com outros termos'
                    : 'Clique em "Sincronizar Contatos" para buscar seus contatos do WhatsApp'}
                </p>
              )}
            </div>
          </GlassCard>
        ) : (
          currentContacts.map(renderContactCard)
        )}
      </div>

      {/* Empty State - No Active Agents */}
      {activeAgents.length === 0 && (
        <GlassCard className="bg-gradient-to-r from-orange-500/10 to-red-500/10 border-orange-500/30">
          <div className="text-center py-8">
            <Bot className="w-16 h-16 text-orange-400 mx-auto mb-4" />
            <h3 className="text-lg font-semibold text-orange-400 mb-2">
              Nenhum Agente Ativo
            </h3>
            <p className="text-text-secondary text-sm">
              Você precisa criar e ativar pelo menos um agente antes de fazer atribuições.
              Vá para a página "Agentes" para criar seu primeiro agente.
            </p>
          </div>
        </GlassCard>
      )}
    </div>
  );
}
