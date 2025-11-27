import { v4 as uuidv4 } from 'uuid';
import { configStore } from '../store/ConfigStore';
import type { Agent, AgentAssignment, AIProvider } from '../../shared/types';

// ============================================
// AGENT MANAGER
// ============================================
// Gerencia agentes e suas atribuições a conversas do WhatsApp

const AGENTS_KEY = 'agents';
const ASSIGNMENTS_KEY = 'agent_assignments';

export class AgentManager {
  private agents: Agent[] = [];
  private assignments: AgentAssignment[] = [];

  constructor() {
    this.loadAgents();
    this.loadAssignments();
    console.log('[AgentManager] Inicializado');
  }

  // ===== CRUD de Agentes =====

  private async loadAgents(): Promise<void> {
    try {
      const saved = await configStore.get(AGENTS_KEY);
      if (saved && Array.isArray(saved)) {
        this.agents = saved as Agent[];
        console.log(`[AgentManager] ${this.agents.length} agente(s) carregado(s)`);
      } else {
        console.log('[AgentManager] Nenhum agente salvo encontrado');
      }
    } catch (error) {
      console.error('[AgentManager] Erro ao carregar agentes:', error);
      this.agents = [];
    }
  }

  private async saveAgents(): Promise<void> {
    try {
      await configStore.set(AGENTS_KEY, this.agents);
      console.log('[AgentManager] Agentes salvos');
    } catch (error) {
      console.error('[AgentManager] Erro ao salvar agentes:', error);
      throw error;
    }
  }

  async createAgent(data: {
    name: string;
    description?: string;
    provider: AIProvider;
    model: string;
    temperature: number;
    maxTokens: number;
    systemPrompt?: string;
  }): Promise<Agent> {
    const agent: Agent = {
      id: uuidv4(),
      name: data.name,
      description: data.description,
      provider: data.provider,
      model: data.model,
      temperature: data.temperature,
      maxTokens: data.maxTokens,
      systemPrompt: data.systemPrompt,
      isActive: false,
      createdAt: new Date().toISOString(),
    };

    this.agents.push(agent);
    await this.saveAgents();

    console.log(`[AgentManager] Agente criado: ${agent.name} (${agent.id})`);
    return agent;
  }

  async updateAgent(id: string, updates: Partial<Omit<Agent, 'id' | 'createdAt'>>): Promise<Agent> {
    const index = this.agents.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Agente não encontrado');
    }

    this.agents[index] = {
      ...this.agents[index],
      ...updates,
      updatedAt: new Date().toISOString(),
    };

    await this.saveAgents();
    console.log(`[AgentManager] Agente atualizado: ${id}`);
    return this.agents[index];
  }

  async deleteAgent(id: string): Promise<void> {
    const index = this.agents.findIndex((a) => a.id === id);
    if (index === -1) {
      throw new Error('Agente não encontrado');
    }

    // Remove todas as atribuições deste agente
    this.assignments = this.assignments.filter((a) => a.agentId !== id);
    await this.saveAssignments();

    this.agents.splice(index, 1);
    await this.saveAgents();

    console.log(`[AgentManager] Agente deletado: ${id}`);
  }

  async toggleAgentActive(id: string): Promise<Agent> {
    const agent = this.agents.find((a) => a.id === id);
    if (!agent) {
      throw new Error('Agente não encontrado');
    }

    agent.isActive = !agent.isActive;
    agent.updatedAt = new Date().toISOString();

    await this.saveAgents();
    console.log(`[AgentManager] Agente ${agent.isActive ? 'ativado' : 'desativado'}: ${id}`);
    return agent;
  }

  async getAgent(id: string): Promise<Agent | null> {
    return this.agents.find((a) => a.id === id) || null;
  }

  async getAllAgents(): Promise<Agent[]> {
    return [...this.agents];
  }

  async getActiveAgents(): Promise<Agent[]> {
    return this.agents.filter((a) => a.isActive);
  }

  async getAgentsByProvider(provider: AIProvider): Promise<Agent[]> {
    return this.agents.filter((a) => a.provider === provider);
  }

  // ===== Atribuições de Agentes =====

  private async loadAssignments(): Promise<void> {
    try {
      const saved = await configStore.get(ASSIGNMENTS_KEY);
      if (saved && Array.isArray(saved)) {
        this.assignments = saved as AgentAssignment[];
        console.log(`[AgentManager] ${this.assignments.length} atribuição(ões) carregada(s)`);
      } else {
        console.log('[AgentManager] Nenhuma atribuição salva encontrada');
      }
    } catch (error) {
      console.error('[AgentManager] Erro ao carregar atribuições:', error);
      this.assignments = [];
    }
  }

  private async saveAssignments(): Promise<void> {
    try {
      await configStore.set(ASSIGNMENTS_KEY, this.assignments);
      console.log('[AgentManager] Atribuições salvas');
    } catch (error) {
      console.error('[AgentManager] Erro ao salvar atribuições:', error);
      throw error;
    }
  }

  async assignAgentToContact(agentId: string, contactPhone: string, contactName?: string): Promise<AgentAssignment> {
    // Verifica se o agente existe
    const agent = await this.getAgent(agentId);
    if (!agent) {
      throw new Error('Agente não encontrado');
    }

    // Remove atribuição anterior deste contato, se existir
    this.assignments = this.assignments.filter((a) => a.contactPhone !== contactPhone);

    const assignment: AgentAssignment = {
      id: uuidv4(),
      agentId,
      contactId: contactPhone, // Usando o número como ID por enquanto
      contactName,
      contactPhone,
      createdAt: new Date().toISOString(),
    };

    this.assignments.push(assignment);
    await this.saveAssignments();

    console.log(`[AgentManager] Agente ${agentId} atribuído ao contato ${contactPhone}`);
    return assignment;
  }

  async removeAssignment(assignmentId: string): Promise<void> {
    const index = this.assignments.findIndex((a) => a.id === assignmentId);
    if (index === -1) {
      throw new Error('Atribuição não encontrada');
    }

    this.assignments.splice(index, 1);
    await this.saveAssignments();

    console.log(`[AgentManager] Atribuição removida: ${assignmentId}`);
  }

  async removeAssignmentByContact(contactPhone: string): Promise<void> {
    const beforeCount = this.assignments.length;
    this.assignments = this.assignments.filter((a) => a.contactPhone !== contactPhone);
    
    if (this.assignments.length < beforeCount) {
      await this.saveAssignments();
      console.log(`[AgentManager] Atribuição removida do contato: ${contactPhone}`);
    }
  }

  async getAssignmentByContact(contactPhone: string): Promise<AgentAssignment | null> {
    return this.assignments.find((a) => a.contactPhone === contactPhone) || null;
  }

  async getAssignmentsByAgent(agentId: string): Promise<AgentAssignment[]> {
    return this.assignments.filter((a) => a.agentId === agentId);
  }

  async getAllAssignments(): Promise<AgentAssignment[]> {
    return [...this.assignments];
  }

  async getAgentForContact(contactPhone: string): Promise<Agent | null> {
    const assignment = await this.getAssignmentByContact(contactPhone);
    if (!assignment) {
      return null;
    }

    return this.getAgent(assignment.agentId);
  }

  // ===== Estatísticas =====

  async getStats(): Promise<{
    totalAgents: number;
    activeAgents: number;
    totalAssignments: number;
    agentsByProvider: Record<string, number>;
  }> {
    const agentsByProvider: Record<string, number> = {};
    
    for (const agent of this.agents) {
      agentsByProvider[agent.provider] = (agentsByProvider[agent.provider] || 0) + 1;
    }

    return {
      totalAgents: this.agents.length,
      activeAgents: this.agents.filter((a) => a.isActive).length,
      totalAssignments: this.assignments.length,
      agentsByProvider,
    };
  }
}

// Singleton
export const agentManager = new AgentManager();

