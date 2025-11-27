import { useEffect, useState } from 'react';
import { GlassCard } from '../components/GlassCard';
import { StatusBadge } from '../components/StatusBadge';
import { Building2, Plus, Edit2, Trash2, Phone, Loader2, X } from 'lucide-react';
import type { Tenant, WhatsAppNumber } from '../../shared/types';

// ============================================
// COMPANIES MANAGER PAGE
// ============================================

export function CompaniesManager() {
  const [tenants, setTenants] = useState<Tenant[]>([]);
  const [numbers, setNumbers] = useState<WhatsAppNumber[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);
  const [editingTenant, setEditingTenant] = useState<Tenant | null>(null);
  const [formData, setFormData] = useState({ name: '' });
  const [showNumberModal, setShowNumberModal] = useState(false);
  const [numberFormData, setNumberFormData] = useState({ tenantId: '', phoneNumber: '' });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setLoading(true);
    try {
      const [tenantsRes, numbersRes] = await Promise.all([
        window.api.tenant.getAll(),
        window.api.whatsappNumber.getAll(),
      ]);

      if (tenantsRes.success && tenantsRes.data) {
        setTenants(tenantsRes.data);
      }

      if (numbersRes.success && numbersRes.data) {
        setNumbers(numbersRes.data);
      }
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveTenant = async () => {
    if (!formData.name.trim()) {
      alert('Por favor, insira o nome da empresa');
      return;
    }

    try {
      if (editingTenant) {
        const response = await window.api.tenant.update(editingTenant.id, { name: formData.name });
        if (response.success) {
          alert('Empresa atualizada! ✅');
        } else {
          alert(`Erro: ${response.error}`);
        }
      } else {
        const response = await window.api.tenant.create({ name: formData.name });
        if (response.success) {
          alert('Empresa criada! ✅');
        } else {
          alert(`Erro: ${response.error}`);
        }
      }

      setShowModal(false);
      setEditingTenant(null);
      setFormData({ name: '' });
      await loadData();
    } catch (error) {
      console.error('Error saving tenant:', error);
      alert('Erro ao salvar empresa');
    }
  };

  const handleDeleteTenant = async (id: string, name: string) => {
    if (!confirm(`Deseja realmente excluir a empresa "${name}"?`)) return;

    try {
      const response = await window.api.tenant.delete(id);
      if (response.success) {
        alert('Empresa excluída! ✅');
        await loadData();
      } else {
        alert(`Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Error deleting tenant:', error);
      alert('Erro ao excluir empresa');
    }
  };

  const handleSaveNumber = async () => {
    if (!numberFormData.tenantId || !numberFormData.phoneNumber) {
      alert('Por favor, preencha todos os campos');
      return;
    }

    // Limpar número (apenas dígitos)
    const cleanNumber = numberFormData.phoneNumber.replace(/\D/g, '');

    try {
      const response = await window.api.whatsappNumber.create({
        tenant_id: numberFormData.tenantId,
        phone_number: cleanNumber,
        is_active: true,
      });

      if (response.success) {
        alert('Número adicionado! ✅');
        setShowNumberModal(false);
        setNumberFormData({ tenantId: '', phoneNumber: '' });
        await loadData();
      } else {
        alert(`Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Error saving number:', error);
      alert('Erro ao adicionar número');
    }
  };

  const handleDeleteNumber = async (id: string, number: string) => {
    if (!confirm(`Deseja realmente remover o número ${number}?`)) return;

    try {
      const response = await window.api.whatsappNumber.delete(id);
      if (response.success) {
        alert('Número removido! ✅');
        await loadData();
      } else {
        alert(`Erro: ${response.error}`);
      }
    } catch (error) {
      console.error('Error deleting number:', error);
      alert('Erro ao remover número');
    }
  };

  const getTenantNumbers = (tenantId: string) => {
    return numbers.filter((n) => n.tenant_id === tenantId);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-12 h-12 text-accent animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-text-primary mb-2">
            Gerenciar Empresas
          </h1>
          <p className="text-text-secondary">
            Configure empresas e associe números WhatsApp
          </p>
        </div>

        <button
          onClick={() => {
            setEditingTenant(null);
            setFormData({ name: '' });
            setShowModal(true);
          }}
          className="btn-primary flex items-center gap-2"
        >
          <Plus className="w-5 h-5" />
          Nova Empresa
        </button>
      </div>

      {/* Tenants List */}
      {tenants.length === 0 ? (
        <GlassCard>
          <div className="text-center py-12">
            <Building2 className="w-16 h-16 text-text-secondary mx-auto mb-4" />
            <p className="text-text-secondary mb-4">Nenhuma empresa cadastrada</p>
            <button
              onClick={() => setShowModal(true)}
              className="btn-primary inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              Adicionar Primeira Empresa
            </button>
          </div>
        </GlassCard>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {tenants.map((tenant) => {
            const tenantNumbers = getTenantNumbers(tenant.id);

            return (
              <GlassCard key={tenant.id}>
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start gap-3">
                    <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center flex-shrink-0">
                      <Building2 className="w-6 h-6 text-accent" />
                    </div>
                    <div>
                      <h3 className="text-xl font-semibold text-text-primary">
                        {tenant.name}
                      </h3>
                      <p className="text-sm text-text-secondary mt-1">
                        ID: {tenant.id.slice(0, 8)}...
                      </p>
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => {
                        setEditingTenant(tenant);
                        setFormData({ name: tenant.name });
                        setShowModal(true);
                      }}
                      className="p-2 hover:bg-white/5 rounded-lg transition-colors"
                      title="Editar"
                    >
                      <Edit2 className="w-4 h-4 text-text-secondary" />
                    </button>
                    <button
                      onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                      className="p-2 hover:bg-red-500/10 rounded-lg transition-colors"
                      title="Excluir"
                    >
                      <Trash2 className="w-4 h-4 text-red-400" />
                    </button>
                  </div>
                </div>

                <div className="divider" />

                {/* Numbers */}
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <h4 className="text-sm font-medium text-text-primary">
                      Números WhatsApp
                    </h4>
                    <button
                      onClick={() => {
                        setNumberFormData({ tenantId: tenant.id, phoneNumber: '' });
                        setShowNumberModal(true);
                      }}
                      className="text-xs text-accent hover:underline flex items-center gap-1"
                    >
                      <Plus className="w-3 h-3" />
                      Adicionar
                    </button>
                  </div>

                  {tenantNumbers.length === 0 ? (
                    <p className="text-sm text-text-secondary">Nenhum número cadastrado</p>
                  ) : (
                    <div className="space-y-2">
                      {tenantNumbers.map((number) => (
                        <div
                          key={number.id}
                          className="flex items-center justify-between p-3 bg-white/5 rounded-lg"
                        >
                          <div className="flex items-center gap-2">
                            <Phone className="w-4 h-4 text-accent" />
                            <span className="text-sm font-mono">+{number.phone_number}</span>
                            {number.is_active && (
                              <StatusBadge status="success" label="" />
                            )}
                          </div>
                          <button
                            onClick={() => handleDeleteNumber(number.id, number.phone_number)}
                            className="p-1 hover:bg-red-500/10 rounded transition-colors"
                          >
                            <X className="w-4 h-4 text-red-400" />
                          </button>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </GlassCard>
            );
          })}
        </div>
      )}

      {/* Tenant Modal */}
      {showModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              {editingTenant ? 'Editar Empresa' : 'Nova Empresa'}
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Nome da Empresa
                </label>
                <input
                  type="text"
                  value={formData.name}
                  onChange={(e) => setFormData({ name: e.target.value })}
                  placeholder="Ex: Loja ABC"
                  className="glass-input"
                  autoFocus
                />
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowModal(false);
                    setEditingTenant(null);
                    setFormData({ name: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveTenant}
                  className="btn-primary flex-1"
                >
                  Salvar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Number Modal */}
      {showNumberModal && (
        <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 p-4">
          <div className="glass-card max-w-md w-full p-6">
            <h2 className="text-2xl font-bold text-text-primary mb-4">
              Adicionar Número WhatsApp
            </h2>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-text-primary mb-2">
                  Número (com código do país)
                </label>
                <input
                  type="tel"
                  value={numberFormData.phoneNumber}
                  onChange={(e) => setNumberFormData({ ...numberFormData, phoneNumber: e.target.value })}
                  placeholder="Ex: 5511999999999"
                  className="glass-input font-mono"
                  autoFocus
                />
                <p className="text-xs text-text-secondary mt-1">
                  Formato: código do país + DDD + número (apenas números)
                </p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => {
                    setShowNumberModal(false);
                    setNumberFormData({ tenantId: '', phoneNumber: '' });
                  }}
                  className="btn-secondary flex-1"
                >
                  Cancelar
                </button>
                <button
                  onClick={handleSaveNumber}
                  className="btn-primary flex-1"
                >
                  Adicionar
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

