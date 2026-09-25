import React, { useState } from 'react';
import { uploadMedia } from '@/core/supabase';
import { useToast } from '@/core/context/ToastContext';
import { compressImageWithStats, formatBytes } from '@/core/utils/image';
import {
  Camera,
  ImagePlus,
  Trash2,
  Loader2,
  ExternalLink,
  ZoomIn,
  X,
  Sparkles,
} from 'lucide-react';

interface OrderPhotoUploadProps {
  label: string;
  photos: string[];
  onChange: (photos: string[]) => void;
  folder?: string;
  disabled?: boolean;
}

export const OrderPhotoUpload: React.FC<OrderPhotoUploadProps> = ({
  label,
  photos,
  onChange,
  folder = 'os',
  disabled = false,
}) => {
  const { success, error: toastError } = useToast();
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<string | null>(null);
  const [previewPhotoUrl, setPreviewPhotoUrl] = useState<string | null>(null);

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];
    const errors: string[] = [];
    let totalOriginalBytes = 0;
    let totalCompressedBytes = 0;

    try {
      const totalCount = files.length;

      for (let i = 0; i < totalCount; i++) {
        const originalFile = files[i];
        setUploadProgress(`Otimizando e enviando ${i + 1} de ${totalCount}...`);

        try {
          // Comprimir imagem no cliente (Canvas 2D, max 1600px, WebP/JPEG qualidade 0.82)
          const compResult = await compressImageWithStats(originalFile, 1600, 0.82);
          totalOriginalBytes += compResult.originalSize;
          totalCompressedBytes += compResult.compressedSize;

          const publicUrl = await uploadMedia(compResult.file, folder);
          newUrls.push(publicUrl);
        } catch (fileErr: any) {
          console.error(`Falha no upload do arquivo ${originalFile.name}:`, fileErr);
          errors.push(originalFile.name);
        }
      }

      if (newUrls.length > 0) {
        onChange([...photos, ...newUrls]);

        const savedBytes = totalOriginalBytes - totalCompressedBytes;
        const savedPct =
          totalOriginalBytes > 0
            ? Math.round((savedBytes / totalOriginalBytes) * 100)
            : 0;

        const statsMsg =
          savedBytes > 0 && totalOriginalBytes > 0
            ? ` (${formatBytes(totalOriginalBytes)} → ${formatBytes(totalCompressedBytes)}, -${savedPct}%)`
            : '';

        if (errors.length === 0) {
          success(
            newUrls.length === 1
              ? `Foto otimizada e salva com sucesso!${statsMsg}`
              : `${newUrls.length} fotos otimizadas e salvas com sucesso!${statsMsg}`
          );
        } else {
          success(
            `${newUrls.length} foto(s) enviada(s)${statsMsg}, mas ${errors.length} falhou.`
          );
        }
      }

      if (errors.length > 0) {
        toastError(
          'Falha parcial no upload',
          `Não foi possível enviar: ${errors.join(', ')}`
        );
      }
    } catch (err: any) {
      console.error('Falha geral no upload:', err);
      toastError('Erro ao enviar foto', err.message || 'Tente novamente');
    } finally {
      setUploading(false);
      setUploadProgress(null);
      e.target.value = '';
    }
  };

  const handleRemovePhoto = (indexToRemove: number) => {
    if (disabled) return;
    onChange(photos.filter((_, idx) => idx !== indexToRemove));
  };

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
          <span>{label}</span>
          <span className="text-slate-400 font-semibold">({photos.length})</span>
        </label>
        {uploading && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            <span>{uploadProgress || 'Otimizando foto...'}</span>
          </span>
        )}
      </div>

      {/* Grid of Existing Photos */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((url, idx) => (
          <div
            key={idx}
            className="group relative aspect-square rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shadow-xs"
          >
            <img
              src={url}
              alt={`${label} ${idx + 1}`}
              className="w-full h-full object-cover cursor-pointer"
              loading="lazy"
              onClick={() => setPreviewPhotoUrl(url)}
            />

            {/* Quick Actions overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 sm:transition-opacity flex items-center justify-center gap-2 p-1">
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setPreviewPhotoUrl(url);
                }}
                aria-label="Ampliar foto"
                className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg bg-white/95 text-slate-900 hover:bg-white active:scale-90 flex items-center justify-center transition-all shadow-xs"
                title="Ampliar foto"
              >
                <ZoomIn className="w-4 h-4" />
              </button>
              {!disabled && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    handleRemovePhoto(idx);
                  }}
                  aria-label="Excluir foto"
                  className="min-h-[44px] min-w-[44px] p-2.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 active:scale-90 flex items-center justify-center transition-all shadow-xs"
                  title="Excluir foto"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              )}
            </div>

            {/* Mobile-visible delete button */}
            {!disabled && (
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  handleRemovePhoto(idx);
                }}
                aria-label="Excluir foto"
                className="sm:hidden absolute top-1 right-1 min-h-[44px] min-w-[44px] p-2.5 rounded-full bg-rose-600 text-white shadow-md active:scale-90 flex items-center justify-center"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            )}
          </div>
        ))}

        {/* Upload Buttons */}
        {!disabled && (
          <>
            {/* Direct Camera Capture */}
            <label className="relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-blue-400/80 bg-blue-50/60 hover:bg-blue-100/70 cursor-pointer active:scale-95 transition-all text-blue-800 shadow-xs">
              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handleFileSelected}
                disabled={uploading}
                className="sr-only"
              />
              <Camera className="w-6 h-6 mb-1 text-blue-700" />
              <span className="text-[11px] font-bold text-center leading-tight">
                Tirar Foto
              </span>
              <span className="text-[9px] text-blue-600 font-medium flex items-center gap-0.5 mt-0.5">
                <Sparkles className="w-2.5 h-2.5" /> Auto-HD
              </span>
            </label>

            {/* Gallery Upload */}
            <label className="relative aspect-square flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-white hover:bg-slate-100/70 cursor-pointer active:scale-95 transition-all text-slate-700 shadow-xs">
              <input
                type="file"
                accept="image/*"
                multiple
                onChange={handleFileSelected}
                disabled={uploading}
                className="sr-only"
              />
              <ImagePlus className="w-6 h-6 mb-1 text-slate-600" />
              <span className="text-[11px] font-bold text-center leading-tight">
                Galeria
              </span>
              <span className="text-[9px] text-slate-400 font-medium mt-0.5">
                Múltiplas
              </span>
            </label>
          </>
        )}
      </div>

      {/* Lightbox In-App Preview Modal */}
      {previewPhotoUrl && (
        <div
          className="fixed inset-0 z-50 bg-black/85 backdrop-blur-xs flex items-center justify-center p-3 animate-in fade-in duration-150"
          onClick={() => setPreviewPhotoUrl(null)}
        >
          <div
            className="relative max-w-4xl max-h-[90vh] flex flex-col items-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="absolute top-2 right-2 flex items-center gap-2 z-10">
              <a
                href={previewPhotoUrl}
                target="_blank"
                rel="noreferrer"
                className="p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all flex items-center justify-center"
                title="Abrir imagem original em nova aba"
              >
                <ExternalLink className="w-5 h-5" />
              </a>
              <button
                type="button"
                onClick={() => setPreviewPhotoUrl(null)}
                className="p-2.5 rounded-full bg-white/20 hover:bg-white/40 text-white backdrop-blur-md transition-all flex items-center justify-center"
                title="Fechar visualização"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <img
              src={previewPhotoUrl}
              alt="Ampliação da foto de serviço"
              className="max-h-[85vh] max-w-full rounded-2xl object-contain shadow-2xl"
            />
          </div>
        </div>
      )}
    </div>
  );
};
