import React, { useState } from 'react';
import { uploadMedia } from '@/core/supabase';
import { useToast } from '@/core/context/ToastContext';
import { compressImage } from '@/core/utils/image';
import { Camera, ImagePlus, Trash2, Loader2, ExternalLink } from 'lucide-react';

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

  const handleFileSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploading(true);
    const newUrls: string[] = [];
    const errors: string[] = [];

    try {
      for (let i = 0; i < files.length; i++) {
        const originalFile = files[i];
        try {
          // Comprimir imagem antes do upload (ex: de 10MB para ~300KB)
          const compressedFile = await compressImage(originalFile);
          const publicUrl = await uploadMedia(compressedFile, folder);
          newUrls.push(publicUrl);
        } catch (fileErr: any) {
          console.error(`Falha no upload do arquivo ${originalFile.name}:`, fileErr);
          errors.push(originalFile.name);
        }
      }

      if (newUrls.length > 0) {
        onChange([...photos, ...newUrls]);
        if (errors.length === 0) {
          success(
            newUrls.length === 1
              ? 'Foto enviada e otimizada com sucesso!'
              : `${newUrls.length} fotos enviadas e otimizadas com sucesso!`
          );
        } else {
          success(`${newUrls.length} foto(s) enviada(s), mas ${errors.length} falhou.`);
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
      // Reset input para permitir selecionar o mesmo arquivo novamente se necessário
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
        <label className="block text-xs font-bold uppercase tracking-wider text-slate-700">
          {label} ({photos.length})
        </label>
        {uploading && (
          <span className="flex items-center gap-1.5 text-xs text-blue-600 font-semibold animate-pulse">
            <Loader2 className="w-3.5 h-3.5 animate-spin" />
            Enviando foto...
          </span>
        )}
      </div>

      {/* Grid of Existing Photos */}
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {photos.map((url, idx) => (
          <div
            key={idx}
            className="group relative aspect-square rounded-xl overflow-hidden bg-slate-200 border border-slate-300 shadow-sm"
          >
            <img
              src={url}
              alt={`${label} ${idx + 1}`}
              className="w-full h-full object-cover"
              loading="lazy"
            />

            {/* Quick Actions overlay */}
            <div className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 sm:transition-opacity flex items-center justify-center gap-2 p-1">
              <a
                href={url}
                target="_blank"
                rel="noreferrer"
                className="p-1.5 rounded-lg bg-white/90 text-slate-800 hover:bg-white active:scale-90"
                title="Ampliar foto"
              >
                <ExternalLink className="w-4 h-4" />
              </a>
              {!disabled && (
                <button
                  type="button"
                  onClick={() => handleRemovePhoto(idx)}
                  className="p-1.5 rounded-lg bg-rose-600 text-white hover:bg-rose-700 active:scale-90"
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
                onClick={() => handleRemovePhoto(idx)}
                className="sm:hidden absolute top-1 right-1 p-1 rounded-full bg-rose-600/90 text-white shadow-md active:scale-90"
              >
                <Trash2 className="w-3.5 h-3.5" />
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
            </label>
          </>
        )}
      </div>
    </div>
  );
};
