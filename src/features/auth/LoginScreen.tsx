import React, { useState } from 'react';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import { ShieldCheck, Wrench, Delete, ArrowLeft, Lock, UserCheck } from 'lucide-react';
import type { Profile } from '@/core/types/database';

export const LoginScreen: React.FC = () => {
  const { profiles, loadingProfiles, loginWithPin } = useAuth();
  const { error: toastError, success: toastSuccess } = useToast();

  const [selectedProfile, setSelectedProfile] = useState<Profile | null>(null);
  const [pin, setPin] = useState<string>('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [pinError, setPinError] = useState(false);

  const handleSelectProfile = (p: Profile) => {
    setSelectedProfile(p);
    setPin('');
    setPinError(false);
  };

  const handleKeyPress = async (digit: string) => {
    if (pin.length >= 4 || isVerifying) return;

    if (navigator.vibrate) {
      navigator.vibrate(20);
    }

    const newPin = pin + digit;
    setPin(newPin);
    setPinError(false);

    if (newPin.length === 4 && selectedProfile) {
      setIsVerifying(true);
      const ok = await loginWithPin(selectedProfile.id, newPin);
      if (ok) {
        if (navigator.vibrate) navigator.vibrate([40, 60, 40]);
        toastSuccess(`Bem-vindo, ${selectedProfile.name}!`);
      } else {
        if (navigator.vibrate) navigator.vibrate(150);
        setPinError(true);
        toastError('PIN incorreto', 'Verifique o código de 4 dígitos digitado.');
        setTimeout(() => {
          setPin('');
          setPinError(false);
        }, 800);
      }
      setIsVerifying(false);
    }
  };

  const handleDelete = () => {
    if (pin.length > 0) {
      if (navigator.vibrate) navigator.vibrate(15);
      setPin((prev) => prev.slice(0, -1));
      setPinError(false);
    }
  };

  const handleClear = () => {
    setPin('');
    setPinError(false);
  };

  if (loadingProfiles) {
    return (
      <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center p-6 text-white">
        <div className="w-14 h-14 border-4 border-amberAlert-500 border-t-transparent rounded-full animate-spin mb-4" />
        <p className="text-slate-400 font-medium">Carregando dados da equipe...</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 via-slate-900 to-industrial-950 flex flex-col justify-between p-4 sm:p-6 text-white select-none">
      {/* Header Branding */}
      <header className="pt-4 pb-2 text-center">
        <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-gradient-to-br from-industrial-700 to-industrial-900 shadow-xl border border-industrial-500/30 mb-3">
          <Wrench className="w-8 h-8 text-amberAlert-500" />
        </div>
        <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">TOPA TUDO</h1>
        <p className="text-xs sm:text-sm text-slate-400 mt-0.5">Operações & Gestão Técnica</p>
      </header>

      {/* Main Content: Select Profile OR Enter PIN */}
      <main className="flex-1 flex flex-col justify-center max-w-sm w-full mx-auto my-auto py-4">
        {!selectedProfile ? (
          <div className="space-y-4 animate-in fade-in zoom-in-95 duration-200">
            <div className="text-center mb-4">
              <h2 className="text-lg font-bold text-slate-100">Quem está acessando?</h2>
              <p className="text-xs text-slate-400">Toque no seu perfil para entrar</p>
            </div>

            <div className="grid grid-cols-1 gap-3">
              {profiles.map((p) => {
                const isAdmin = p.role === 'adm';
                return (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => handleSelectProfile(p)}
                    className="flex items-center justify-between p-4 rounded-2xl bg-slate-800/80 hover:bg-slate-800 border border-slate-700/80 active:scale-[0.98] transition-all shadow-lg min-h-[64px]"
                  >
                    <div className="flex items-center gap-3.5 text-left">
                      <div
                        className={`w-12 h-12 rounded-xl flex items-center justify-center shrink-0 shadow-inner ${
                          isAdmin
                            ? 'bg-amber-500/20 text-amberAlert-500 border border-amber-500/40'
                            : 'bg-blue-500/20 text-blue-400 border border-blue-500/40'
                        }`}
                      >
                        {isAdmin ? <ShieldCheck className="w-6 h-6" /> : <Wrench className="w-6 h-6" />}
                      </div>
                      <div>
                        <div className="font-bold text-base text-white">{p.name}</div>
                        <div className="text-xs text-slate-400 font-medium tracking-wide uppercase">
                          {isAdmin ? 'Administrador' : 'Técnico de Campo'}
                        </div>
                      </div>
                    </div>
                    <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-slate-700/60 text-slate-300">
                      Entrar →
                    </span>
                  </button>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center animate-in fade-in slide-in-from-bottom-3 duration-200">
            {/* Top Bar with Back Button */}
            <div className="w-full flex items-center justify-between mb-4">
              <button
                type="button"
                onClick={() => {
                  setSelectedProfile(null);
                  setPin('');
                }}
                className="flex items-center gap-1.5 text-slate-300 hover:text-white px-3 py-2 rounded-xl bg-slate-800/60 active:bg-slate-700 text-sm font-medium transition-colors"
              >
                <ArrowLeft className="w-4 h-4" />
                <span>Trocar</span>
              </button>

              <div className="flex items-center gap-2">
                <span
                  className={`text-xs px-2.5 py-1 rounded-full font-semibold uppercase ${
                    selectedProfile.role === 'adm'
                      ? 'bg-amber-500/20 text-amber-300 border border-amber-500/40'
                      : 'bg-blue-500/20 text-blue-300 border border-blue-500/40'
                  }`}
                >
                  {selectedProfile.role === 'adm' ? 'ADM' : 'Técnico'}
                </span>
              </div>
            </div>

            {/* Profile Avatar & Name */}
            <div className="text-center mb-6">
              <div className="w-16 h-16 mx-auto rounded-full bg-industrial-800/80 border-2 border-industrial-400/40 flex items-center justify-center mb-2 shadow-inner">
                <UserCheck className="w-8 h-8 text-blue-300" />
              </div>
              <h3 className="text-xl font-bold text-white">{selectedProfile.name}</h3>
              <p className="text-xs text-slate-400 flex items-center justify-center gap-1 mt-1">
                <Lock className="w-3 h-3 text-amberAlert-500" /> Digite seu PIN de 4 dígitos
              </p>
            </div>

            {/* PIN Dots Indicator */}
            <div className="flex items-center gap-4 mb-6">
              {[0, 1, 2, 3].map((index) => {
                const filled = pin.length > index;
                return (
                  <div
                    key={index}
                    className={`w-4 h-4 rounded-full transition-all duration-200 border-2 ${
                      pinError
                        ? 'border-rose-500 bg-rose-500 animate-shake'
                        : filled
                        ? 'border-amberAlert-500 bg-amberAlert-500 scale-110 shadow-lg shadow-amber-500/30'
                        : 'border-slate-600 bg-slate-800/60'
                    }`}
                  />
                );
              })}
            </div>

            {/* On-screen Keypad - Ergonomic Min-Touch 56px */}
            <div className="w-full max-w-[280px] grid grid-cols-3 gap-3">
              {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((digit) => (
                <button
                  key={digit}
                  type="button"
                  onClick={() => handleKeyPress(digit)}
                  className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700/80 active:bg-industrial-600 active:scale-95 border border-slate-700/70 text-2xl font-bold text-white flex items-center justify-center transition-all shadow-md"
                >
                  {digit}
                </button>
              ))}

              <button
                type="button"
                onClick={handleClear}
                className="h-14 sm:h-16 rounded-2xl bg-slate-800/40 hover:bg-slate-800/60 active:scale-95 border border-slate-700/50 text-xs font-semibold text-slate-400 flex items-center justify-center transition-all"
              >
                LIMPAR
              </button>

              <button
                type="button"
                onClick={() => handleKeyPress('0')}
                className="h-14 sm:h-16 rounded-2xl bg-slate-800/90 hover:bg-slate-700/80 active:bg-industrial-600 active:scale-95 border border-slate-700/70 text-2xl font-bold text-white flex items-center justify-center transition-all shadow-md"
              >
                0
              </button>

              <button
                type="button"
                onClick={handleDelete}
                className="h-14 sm:h-16 rounded-2xl bg-slate-800/60 hover:bg-rose-900/30 active:scale-95 border border-slate-700/50 text-slate-300 hover:text-rose-400 flex items-center justify-center transition-all"
                aria-label="Apagar dígito"
              >
                <Delete className="w-6 h-6" />
              </button>
            </div>
          </div>
        )}
      </main>

      {/* Footer hint */}
      <footer className="py-2 text-center text-xs text-slate-500">
        Topa Tudo PWA v1.0 • Acesso Seguro Offline & Online
      </footer>
    </div>
  );
};
