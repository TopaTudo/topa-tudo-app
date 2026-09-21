import React, { useState, useEffect } from 'react';
import { supabase } from '@/core/supabase';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import type { Profile } from '@/core/types/database';
import {
  UsersRound,
  ShieldCheck,
  ShieldAlert,
  Wrench,
  Plus,
  KeyRound,
  CheckCircle,
  XCircle,
  Edit2,
  X,
  Save,
  Lock,
} from 'lucide-react';

export const TechManagementView: React.FC = () => {
  const { profiles, refreshProfiles, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [loading, setLoading] = useState(false);

  // Modal Create / Edit Profile
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<Profile | null>(null);
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [role, setRole] = useState<'adm' | 'tecnico'>('tecnico');
  const [saving, setSaving] = useState(false);

  // Modal Change PIN
  const [isPinModalOpen, setIsPinModalOpen] = useState(false);
  const [profileForPin, setProfileForPin] = useState<Profile | null>(null);
  const [newPin, setNewPin] = useState('');

  const handleOpenCreate = () => {
    setEditingProfile(null);
    setName('');
    setPin('');
    setRole('tecnico');
    setIsModalOpen(true);
  };

  const handleOpenEdit = (p: Profile) => {
    setEditingProfile(p);
    setName(p.name);
    setPin(''); // Deixa em branco ao editar para não expor ou sobrescrever sem intenção
    setRole(p.role);
    setIsModalOpen(true);
  };

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    if (editingProfile) {
      if (pin && !/^[0-9]{4}$/.test(pin)) {
        toastError('PIN Inválido', 'O novo PIN deve conter exatamente 4 dígitos numéricos.');
        return;
      }
    } else {
      if (!/^[0-9]{4}$/.test(pin)) {
        toastError('PIN Inválido', 'O PIN deve conter exatamente 4 dígitos numéricos.');
        return;
      }
    }

    setSaving(true);
    try {
      if (editingProfile) {
        const updatePayload: Record<string, any> = {
          name: name.trim(),
          role,
        };
        if (pin.trim()) {
          updatePayload.pin = pin;
        }

        const { error } = await supabase
          .from('profiles')
          .update(updatePayload)
          .eq('id', editingProfile.id);

        if (error) throw error;
        success('Perfil de técnico atualizado!');
      } else {
        const { error } = await supabase.from('profiles').insert({
          name: name.trim(),
          pin,
          role,
          active: true,
        });

        if (error) throw error;
        success('Novo integrante cadastrado com sucesso!');
      }

      setIsModalOpen(false);
      await refreshProfiles();
    } catch (err: any) {
      toastError('Erro ao salvar técnico', err.message);
    } finally {
      setSaving(false);
    }
  };

  // Toggle active/inactive
  const handleToggleActive = async (p: Profile) => {
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ active: !p.active })
        .eq('id', p.id);

      if (error) throw error;
      success(`Técnico ${!p.active ? 'ativado' : 'desativado'} com sucesso!`);
      await refreshProfiles();
    } catch (err: any) {
      toastError('Erro ao alterar status', err.message);
    }
  };

  // Quick Change PIN
  const handleOpenChangePin = (p: Profile) => {
    setProfileForPin(p);
    setNewPin('');
    setIsPinModalOpen(true);
  };

  const handleSavePin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profileForPin) return;

    if (!/^[0-9]{4}$/.test(newPin)) {
      toastError('PIN Inválido', 'O PIN deve conter exatamente 4 dígitos numéricos.');
      return;
    }

    try {
      const { error } = await supabase
        .from('profiles')
        .update({ pin: newPin })
        .eq('id', profileForPin.id);

      if (error) throw error;
      success(`PIN de ${profileForPin.name} alterado com sucesso!`);
      setIsPinModalOpen(false);
      await refreshProfiles();
    } catch (err: any) {
      toastError('Erro ao atualizar PIN', err.message);
    }
  };

  if (!isAdmin) {
    return (
      <div className="flex flex-col items-center justify-center p-8 sm:p-12 bg-white rounded-3xl border border-slate-200 text-center min-h-[400px] shadow-xs">
        <div className="w-16 h-16 rounded-2xl bg-amber-100 border border-amber-200 flex items-center justify-center text-amber-600 mb-4 shadow-inner">
          <ShieldAlert className="w-8 h-8" />
        </div>
        <h2 className="text-xl sm:text-2xl font-black text-industrial-900 mb-2">
          Acesso Restrito à Gestão de Equipe
        </h2>
        <p className="text-sm text-slate-500 max-w-md">
          Apenas administradores podem gerenciar técnicos, funções e credenciais de acesso.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Top Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200 shadow-xs">
        <div>
          <h1 className="text-xl sm:text-2xl font-black text-industrial-900 tracking-tight">
            Equipe & Técnicos
          </h1>
          <p className="text-xs text-slate-500 mt-0.5">
            Gestão de acessos, funções e PIN de segurança dos técnicos
          </p>
        </div>

        <button
          type="button"
          onClick={handleOpenCreate}
          className="flex items-center justify-center gap-2 px-5 py-3 rounded-xl bg-industrial-800 hover:bg-industrial-900 active:scale-95 text-white font-bold text-sm shadow-md transition-all min-h-[48px]"
        >
          <Plus className="w-5 h-5 text-amberAlert-500" />
          <span>Novo Integrante</span>
        </button>
      </div>

      {/* Technicians List */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {profiles.map((p) => {
          const isAdmin = p.role === 'adm';
          return (
            <div
              key={p.id}
              className={`bg-white rounded-2xl border p-4 shadow-xs flex flex-col justify-between gap-3 ${
                p.active ? 'border-slate-200' : 'border-slate-200 opacity-60 bg-slate-50'
              }`}
            >
              <div>
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-3">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shadow-inner ${
                        isAdmin
                          ? 'bg-amber-500/20 text-amberAlert-600 border border-amber-500/30'
                          : 'bg-blue-500/20 text-industrial-800 border border-blue-500/30'
                      }`}
                    >
                      {isAdmin ? (
                        <ShieldCheck className="w-6 h-6" />
                      ) : (
                        <Wrench className="w-6 h-6" />
                      )}
                    </div>

                    <div>
                      <h3 className="font-bold text-base text-slate-900 leading-tight">{p.name}</h3>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={`text-[10px] font-extrabold uppercase px-2 py-0.5 rounded-full ${
                            isAdmin
                              ? 'bg-amber-100 text-amber-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {isAdmin ? 'Administrador' : 'Técnico de Campo'}
                        </span>
                        <span
                          className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                            p.active
                              ? 'bg-emerald-100 text-emerald-800'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {p.active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => handleOpenChangePin(p)}
                      className="p-2 rounded-xl text-slate-400 hover:text-amberAlert-600 hover:bg-slate-100"
                      title="Alterar PIN"
                    >
                      <KeyRound className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => handleOpenEdit(p)}
                      className="p-2 rounded-xl text-slate-400 hover:text-industrial-800 hover:bg-slate-100"
                      title="Editar dados"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                <div className="mt-2 pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                  <span className="flex items-center gap-1">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    PIN de Acesso: <strong className="font-mono text-slate-700">••••</strong>
                  </span>

                  <button
                    type="button"
                    onClick={() => handleToggleActive(p)}
                    className="font-semibold text-[11px] text-slate-600 hover:text-slate-900 underline"
                  >
                    {p.active ? 'Desativar' : 'Reativar'}
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Modal Profile Create / Edit */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-md overflow-hidden shadow-2xl flex flex-col max-h-[90vh] animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">
                {editingProfile ? 'Editar Usuário' : 'Novo Integrante da Equipe'}
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSaveProfile} className="p-4 sm:p-6 space-y-3.5">
              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Nome Completo *
                </label>
                <input
                  type="text"
                  required
                  placeholder="Ex: Carlos Técnico"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  Função / Papel no Sistema *
                </label>
                <select
                  value={role}
                  onChange={(e) => setRole(e.target.value as any)}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-sm bg-white"
                >
                  <option value="tecnico">Técnico de Campo (Acesso Operacional)</option>
                  <option value="adm">Administrador (Acesso Total & Financeiro)</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-bold uppercase text-slate-700 mb-1">
                  {editingProfile ? 'Alterar PIN (Opcional - 4 dígitos)' : 'PIN de 4 Dígitos Numéricos *'}
                </label>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required={!editingProfile}
                  placeholder={editingProfile ? 'Deixe vazio para manter o atual' : '0000'}
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
                  className="w-full px-3 py-2 rounded-xl border border-slate-300 text-base font-mono text-center tracking-widest"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600 hover:bg-slate-100"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md flex items-center gap-1.5"
                >
                  <Save className="w-4 h-4" />
                  <span>{saving ? 'Gravando...' : 'Salvar Perfil'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal Quick Change PIN */}
      {isPinModalOpen && profileForPin && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4">
          <div className="bg-white rounded-3xl w-full max-w-sm overflow-hidden shadow-2xl flex flex-col animate-in zoom-in-95 duration-150">
            <div className="px-5 py-4 bg-industrial-900 text-white flex items-center justify-between">
              <h2 className="text-base font-bold">Alterar PIN</h2>
              <button
                type="button"
                onClick={() => setIsPinModalOpen(false)}
                className="p-1 rounded-lg text-slate-300 hover:text-white"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleSavePin} className="p-4 sm:p-6 space-y-4 text-center">
              <p className="text-xs text-slate-600">
                Defina um novo PIN de 4 dígitos para <strong>{profileForPin.name}</strong>
              </p>

              <div>
                <input
                  type="password"
                  inputMode="numeric"
                  maxLength={4}
                  required
                  autoFocus
                  placeholder="••••"
                  value={newPin}
                  onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
                  className="w-36 mx-auto px-4 py-3 rounded-2xl border-2 border-industrial-800 text-2xl font-mono text-center tracking-widest focus:outline-hidden"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-slate-200">
                <button
                  type="button"
                  onClick={() => setIsPinModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl border border-slate-300 text-xs font-bold text-slate-600"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={newPin.length !== 4}
                  className="px-5 py-2.5 rounded-xl bg-industrial-800 hover:bg-industrial-700 text-white font-bold text-xs shadow-md disabled:opacity-50"
                >
                  Confirmar Novo PIN
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
