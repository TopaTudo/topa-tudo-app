import React, { createContext, useContext, useState, useCallback } from 'react';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface Toast {
  id: string;
  type: ToastType;
  title: string;
  message?: string;
}

interface ToastContextData {
  showToast: (type: ToastType, title: string, message?: string) => void;
  success: (title: string, message?: string) => void;
  error: (title: string, message?: string) => void;
  warning: (title: string, message?: string) => void;
  info: (title: string, message?: string) => void;
}

const ToastContext = createContext<ToastContextData>({} as ToastContextData);

export const ToastProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback((type: ToastType, title: string, message?: string) => {
    const id = Math.random().toString(36).substring(2, 9);
    setToasts((prev) => [...prev, { id, type, title, message }]);

    // Auto dismiss after 4 seconds
    setTimeout(() => {
      removeToast(id);
    }, 4000);
  }, [removeToast]);

  const success = useCallback((title: string, message?: string) => showToast('success', title, message), [showToast]);
  const error = useCallback((title: string, message?: string) => showToast('error', title, message), [showToast]);
  const warning = useCallback((title: string, message?: string) => showToast('warning', title, message), [showToast]);
  const info = useCallback((title: string, message?: string) => showToast('info', title, message), [showToast]);

  return (
    <ToastContext.Provider value={{ showToast, success, error, warning, info }}>
      {children}
      {/* Toast Overlay Container */}
      <div className="fixed top-4 right-4 left-4 z-50 flex flex-col gap-2 pointer-events-none max-w-md mx-auto sm:left-auto">
        {toasts.map((toast) => {
          const bgColors = {
            success: 'bg-emerald-800 text-white border-emerald-600',
            error: 'bg-rose-800 text-white border-rose-600',
            warning: 'bg-amber-700 text-white border-amber-500',
            info: 'bg-blue-800 text-white border-blue-600',
          };

          const icons = {
            success: <CheckCircle2 className="w-5 h-5 text-emerald-300 shrink-0 mt-0.5" />,
            error: <AlertCircle className="w-5 h-5 text-rose-300 shrink-0 mt-0.5" />,
            warning: <AlertTriangle className="w-5 h-5 text-amber-300 shrink-0 mt-0.5" />,
            info: <Info className="w-5 h-5 text-blue-300 shrink-0 mt-0.5" />,
          };

          return (
            <div
              key={toast.id}
              className={`pointer-events-auto flex items-start gap-3 p-4 rounded-xl border shadow-xl backdrop-blur-sm transition-all transform animate-in slide-in-from-top-2 duration-200 ${bgColors[toast.type]}`}
            >
              {icons[toast.type]}
              <div className="flex-1">
                <h4 className="font-bold text-sm leading-tight">{toast.title}</h4>
                {toast.message && <p className="text-xs text-slate-200 mt-1">{toast.message}</p>}
              </div>
              <button
                type="button"
                onClick={() => removeToast(toast.id)}
                className="text-slate-300 hover:text-white p-1 rounded -mr-1 -mt-1 active:scale-95"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
};

export const useToast = () => useContext(ToastContext);
