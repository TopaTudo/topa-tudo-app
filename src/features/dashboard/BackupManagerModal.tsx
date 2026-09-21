import React, { useState, useEffect } from 'react';
import { useAuth } from '@/core/context/AuthContext';
import { useToast } from '@/core/context/ToastContext';
import {
  generateAndDownloadBackup,
  listStoredBackups,
  downloadStoredBackup,
  StoredBackupFile,
  CORE_TABLES
} from '@/core/services/backupService';
import {
  X,
  Database,
  Download,
  ShieldCheck,
  CheckCircle2,
  Clock,
  HardDrive,
  Cloud,
  AlertCircle,
  RefreshCw,
  FileArchive,
  Layers,
  ArrowDownToLine
} from 'lucide-react';

interface BackupManagerModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const BackupManagerModal: React.FC<BackupManagerModalProps> = ({ isOpen, onClose }) => {
  const { currentProfile, isAdmin } = useAuth();
  const { success, error: toastError } = useToast();

  const [generating, setGenerating] = useState(false);
  const [progressMsg, setProgressMsg] = useState('');
  const [storedBackups, setStoredBackups] = useState<StoredBackupFile[]>([]);
  const [loadingList, setLoadingList] = useState(false);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  const [lastGeneratedSummary, setLastGeneratedSummary] = useState<Record<string, number> | null>(null);

  const fetchBackupsList = async () => {
    setLoadingList(true);
    try {
      const list = await listStoredBackups();
      setStoredBackups(list);
    } catch (err: any) {
      console.error('Erro ao listar backups:', err);
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      fetchBackupsList();
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleGenerateBackup = async () => {
    if (!isAdmin) {
      toastError('Acesso negado', 'Apenas administradores podem gerar backups do sistema.');
      return;
    }

    setGenerating(true);
    setProgressMsg('Iniciando processo de backup...');
    setLastGeneratedSummary(null);

    try {
      const result = await generateAndDownloadBackup(currentProfile?.name, (step) => {
        setProgressMsg(step);
      });

      setLastGeneratedSummary(result.tablesSummary);
      success('Backup gerado e baixado com sucesso!', `${result.totalRecords} registros exportados.`);
      
      // Atualizar lista de backups do storage
      await fetchBackupsList();
    } catch (err: any) {
      console.error('Erro ao gerar backup:', err);
      toastError('Falha ao gerar backup', err.message || 'Erro inesperado.');
    } finally {
      setGenerating(false);
      setProgressMsg('');
    }
  };

  const handleDownloadStored = async (filename: string) => {
    setDownloadingFile(filename);
    try {
      await downloadStoredBackup(filename);
      success('Download concluído', `Arquivo ${filename} baixado.`);
    } catch (err: any) {
      toastError('Erro ao baixar backup', err.message);
    } finally {
      setDownloadingFile(null);
    }
  };

  const formatBytes = (bytes: number) => {
    if (!bytes || bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-200">
      <div className="bg-white rounded-3xl max-w-2xl w-full max-h-[90vh] flex flex-col shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="p-5 border-b border-slate-100 flex items-center justify-between bg-industrial-900 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-industrial-800 border border-industrial-700 flex items-center justify-center text-amberAlert-500 shadow-inner">
              <Database className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base text-white flex items-center gap-2">
                Central de Backups do Sistema
                <span className="text-[10px] uppercase font-black px-2 py-0.5 rounded-full bg-emerald-500/20 text-emerald-300 border border-emerald-500/30">
                  Protegido
                </span>
              </h3>
              <p className="text-xs text-blue-200/80">
                Exportação de segurança, redundância na nuvem e política de rotação 24h
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar gerenciador de backup"
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-slate-400 hover:text-white hover:bg-slate-800 active:scale-95 transition-all"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1 bg-slate-50/50">
          {/* Main Action Banner */}
          <div className="p-5 rounded-2xl bg-gradient-to-br from-industrial-900 via-industrial-800 to-slate-900 text-white shadow-md border border-slate-700/50">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <span className="text-[11px] font-extrabold uppercase tracking-wider text-amberAlert-400 block">
                  Snapshot Completo Sob Demanda
                </span>
                <h4 className="text-lg font-black text-white">
                  Backup Manual Instantâneo
                </h4>
                <p className="text-xs text-slate-300 max-w-md leading-relaxed">
                  Gera uma cópia fiel de todas as 10 tabelas operacionais, faz o download imediato para seu dispositivo e sincroniza no bucket privado do Supabase.
                </p>
              </div>

              <button
                type="button"
                onClick={handleGenerateBackup}
                disabled={generating}
                className="flex items-center justify-center gap-2.5 px-5 py-3.5 rounded-xl bg-amberAlert-500 hover:bg-amberAlert-600 text-industrial-950 font-black text-sm shadow-lg active:scale-95 transition-all disabled:opacity-50 shrink-0 cursor-pointer"
              >
                {generating ? (
                  <>
                    <RefreshCw className="w-4 h-4 animate-spin text-industrial-950" />
                    <span>Gerando Snapshot...</span>
                  </>
                ) : (
                  <>
                    <ArrowDownToLine className="w-4 h-4 text-industrial-950" />
                    <span>Gerar Backup do Sistema Agora</span>
                  </>
                )}
              </button>
            </div>

            {generating && progressMsg && (
              <div className="mt-4 p-3 rounded-xl bg-slate-950/60 border border-slate-700/60 text-xs text-amber-200 flex items-center gap-2 animate-pulse">
                <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                <span>{progressMsg}</span>
              </div>
            )}

            {lastGeneratedSummary && (
              <div className="mt-4 p-3 rounded-xl bg-emerald-950/40 border border-emerald-500/30 text-xs text-emerald-200">
                <div className="font-bold mb-1.5 flex items-center gap-1.5 text-emerald-300">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Resumo do Snapshot Gerado:</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-1.5 text-[11px]">
                  {Object.entries(lastGeneratedSummary).map(([tbl, count]) => (
                    <div key={tbl} className="bg-emerald-900/30 px-2 py-1 rounded">
                      <span className="text-slate-300">{tbl}:</span>{' '}
                      <strong className="text-emerald-300">{count}</strong>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Backup Policy Information Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center gap-2 text-indigo-700 font-bold text-xs">
                <Clock className="w-4 h-4" />
                <span>Agendamento Diário</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Executado todos os dias às <strong>00:00 BRT (03:00 UTC)</strong> de forma automatizada via GitHub Actions.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center gap-2 text-emerald-700 font-bold text-xs">
                <ShieldCheck className="w-4 h-4" />
                <span>Rotação Estrita 24h</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Garante a retenção permanente de <strong>pelo menos 2 backups diários</strong> com espaçamento mínimo de 24h entre eles.
              </p>
            </div>

            <div className="p-3.5 rounded-2xl bg-white border border-slate-200 shadow-xs space-y-1">
              <div className="flex items-center gap-2 text-blue-700 font-bold text-xs">
                <Cloud className="w-4 h-4" />
                <span>Redundância Tripla</span>
              </div>
              <p className="text-[11px] text-slate-500">
                Cópias locais em <code>backups/</code>, no bucket seguro do Supabase e nos artefatos do GitHub (30 dias).
              </p>
            </div>
          </div>

          {/* Stored Cloud Backups List */}
          <div className="bg-white rounded-2xl border border-slate-200 shadow-xs overflow-hidden">
            <div className="p-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
              <div className="flex items-center gap-2">
                <FileArchive className="w-4 h-4 text-industrial-800" />
                <h4 className="font-bold text-xs text-slate-800 uppercase tracking-wider">
                  Backups Armazenados no Bucket Supabase
                </h4>
              </div>
              <button
                type="button"
                onClick={fetchBackupsList}
                disabled={loadingList}
                className="p-1.5 rounded-lg text-slate-500 hover:text-slate-800 hover:bg-slate-200 active:scale-95 transition-all text-xs flex items-center gap-1"
                title="Atualizar lista"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loadingList ? 'animate-spin' : ''}`} />
                <span className="hidden sm:inline">Atualizar</span>
              </button>
            </div>

            <div className="divide-y divide-slate-100 max-h-60 overflow-y-auto">
              {loadingList ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  <RefreshCw className="w-5 h-5 animate-spin mx-auto mb-2 text-industrial-800" />
                  Carregando lista de backups da nuvem...
                </div>
              ) : storedBackups.length === 0 ? (
                <div className="p-8 text-center text-xs text-slate-400">
                  Nenhum backup encontrado no bucket. Clique em "Gerar Backup Agora" para criar o primeiro.
                </div>
              ) : (
                storedBackups.map((file) => (
                  <div
                    key={file.name}
                    className="p-3.5 flex items-center justify-between hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-industrial-100 text-industrial-800 flex items-center justify-center shrink-0">
                        <FileArchive className="w-4 h-4" />
                      </div>
                      <div>
                        <span className="font-bold text-xs text-slate-800 block">
                          {file.name}
                        </span>
                        <div className="flex items-center gap-2 text-[10px] text-slate-400 mt-0.5">
                          <span>{formatBytes(file.size)}</span>
                          <span>•</span>
                          <span>{file.isGzip ? 'Compactado Gzip' : 'JSON'}</span>
                          {file.createdAt && (
                            <>
                              <span>•</span>
                              <span>{new Date(file.createdAt).toLocaleString('pt-BR')}</span>
                            </>
                          )}
                        </div>
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => handleDownloadStored(file.name)}
                      disabled={downloadingFile === file.name}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-slate-100 hover:bg-industrial-800 hover:text-white text-slate-700 text-xs font-semibold active:scale-95 transition-all disabled:opacity-50"
                    >
                      {downloadingFile === file.name ? (
                        <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                      ) : (
                        <Download className="w-3.5 h-3.5" />
                      )}
                      <span>Baixar</span>
                    </button>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Tables Included Summary */}
          <div className="p-3.5 rounded-xl bg-blue-50 border border-blue-200 text-xs text-blue-900">
            <span className="font-bold block mb-1">Tabelas sincronizadas no snapshot:</span>
            <div className="flex flex-wrap gap-1.5">
              {CORE_TABLES.map((t) => (
                <span
                  key={t}
                  className="px-2 py-0.5 rounded-md bg-white border border-blue-200 text-[11px] font-mono font-medium text-blue-800 shadow-2xs"
                >
                  {t}
                </span>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 border-t border-slate-100 bg-white flex items-center justify-between">
          <span className="text-[11px] text-slate-400">
            Topa Tudo • Segurança e Continuidade de Negócios
          </span>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 font-bold text-xs active:scale-95 transition-all"
          >
            Fechar
          </button>
        </div>
      </div>
    </div>
  );
};
