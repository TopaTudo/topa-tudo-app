import React, { useRef, useState, useEffect, useCallback } from 'react';
import { uploadMedia } from '@/core/supabase';
import { useToast } from '@/core/context/ToastContext';
import { RotateCcw, Check, PenTool, Loader2, X } from 'lucide-react';

export interface SignaturePadProps {
  onSave: (signatureUrl: string) => void | Promise<void>;
  onCancel?: () => void;
  title?: string;
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSave,
  onCancel,
  title = 'Assinatura Digital do Cliente',
  disabled = false,
}) => {
  const { warning, error: toastError } = useToast();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);

  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);
  const [saving, setSaving] = useState(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Redimensionar canvas de acordo com o tamanho real do container e DPI
  const resizeCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    if (rect.width === 0) return;

    const dpr = Math.max(window.devicePixelRatio || 1, 2);
    const width = rect.width;
    const height = Math.min(240, Math.max(180, Math.round(width * 0.45)));

    // Salva o conteúdo anterior se houver para restaurar se redimensionar
    const tempCanvas = document.createElement('canvas');
    tempCanvas.width = canvas.width;
    tempCanvas.height = canvas.height;
    const tempCtx = tempCanvas.getContext('2d');
    if (tempCtx && canvas.width > 0 && canvas.height > 0) {
      tempCtx.drawImage(canvas, 0, 0);
    }

    canvas.width = width * dpr;
    canvas.height = height * dpr;
    canvas.style.width = `${width}px`;
    canvas.style.height = `${height}px`;

    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.scale(dpr, dpr);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Linha guia sutil de assinatura
      ctx.save();
      ctx.strokeStyle = '#e2e8f0';
      ctx.lineWidth = 1.5;
      ctx.setLineDash([6, 6]);
      ctx.beginPath();
      ctx.moveTo(30, height - 40);
      ctx.lineTo(width - 30, height - 40);
      ctx.stroke();
      ctx.restore();

      // Restaura o desenho anterior se havia
      if (hasDrawn && tempCanvas.width > 0) {
        ctx.drawImage(tempCanvas, 0, 0, width, height);
      }
    }
  }, [hasDrawn]);

  useEffect(() => {
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    return () => window.removeEventListener('resize', resizeCanvas);
  }, [resizeCanvas]);

  // Obter coordenadas exatas no espaço CSS do canvas
  const getCoordinates = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;

    const rect = canvas.getBoundingClientRect();
    let clientX = 0;
    let clientY = 0;

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      clientX = e.touches[0].clientX;
      clientY = e.touches[0].clientY;
    } else {
      clientX = e.clientX;
      clientY = e.clientY;
    }

    return {
      x: clientX - rect.left,
      y: clientY - rect.top,
    };
  };

  const startDrawing = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (disabled || saving) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }

    const coords = getCoordinates(e);
    if (!coords) return;

    setIsDrawing(true);
    setHasDrawn(true);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.save();
    ctx.beginPath();
    ctx.arc(coords.x, coords.y, 1.5, 0, Math.PI * 2);
    ctx.fillStyle = '#0f172a';
    ctx.fill();
    ctx.restore();
  };

  const draw = (
    e: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if (!isDrawing || disabled || saving) return;
    if ('touches' in e && e.cancelable) {
      e.preventDefault();
    }

    const coords = getCoordinates(e);
    if (!coords || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.strokeStyle = '#0f172a';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const stopDrawing = (
    e?: React.MouseEvent<HTMLCanvasElement> | React.TouchEvent<HTMLCanvasElement>
  ) => {
    if ('touches' in (e || {}) && (e as React.TouchEvent).cancelable) {
      (e as React.TouchEvent).preventDefault();
    }
    setIsDrawing(false);
    lastPointRef.current = null;
  };

  // Limpar canvas
  const handleClear = () => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const width = rect.width;
    const height = Math.min(240, Math.max(180, Math.round(width * 0.45)));

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, width, height);

    // Linha guia sutil de assinatura
    ctx.save();
    ctx.strokeStyle = '#e2e8f0';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 6]);
    ctx.beginPath();
    ctx.moveTo(30, height - 40);
    ctx.lineTo(width - 30, height - 40);
    ctx.stroke();
    ctx.restore();

    setHasDrawn(false);
  };

  // Salvar imagem e fazer upload para o Supabase
  const handleConfirm = async () => {
    if (!hasDrawn) {
      warning('Assinatura em branco', 'Por favor, colete a assinatura do cliente antes de confirmar.');
      return;
    }

    const canvas = canvasRef.current;
    if (!canvas) return;

    setSaving(true);

    try {
      // Converte canvas para Blob PNG
      const blob = await new Promise<Blob | null>((resolve) => {
        canvas.toBlob((b) => resolve(b), 'image/png', 0.95);
      });

      if (!blob) {
        throw new Error('Falha ao processar imagem da assinatura.');
      }

      // Upload direto para o bucket topatudo-media na pasta 'signatures'
      const publicUrl = await uploadMedia(blob, 'signatures');

      await onSave(publicUrl);
    } catch (err: any) {
      console.error('Erro ao salvar assinatura:', err);
      toastError('Erro no upload da assinatura', err.message || 'Verifique sua conexão e tente novamente.');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="bg-white rounded-2xl border-2 border-industrial-700/30 overflow-hidden shadow-lg animate-in fade-in zoom-in-95 duration-200">
      {/* Top Header */}
      <div className="bg-industrial-900 text-white px-4 py-2.5 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <PenTool className="w-4 h-4 text-amberAlert-500" />
          <span className="text-xs sm:text-sm font-black tracking-tight">{title}</span>
        </div>
        {onCancel && (
          <button
            type="button"
            onClick={onCancel}
            disabled={saving}
            className="text-slate-400 hover:text-white p-1 rounded-lg active:scale-95 transition-all"
            aria-label="Cancelar assinatura"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Canvas Area with Touch Action None */}
      <div
        ref={containerRef}
        className="relative bg-white touch-none select-none p-1"
        style={{ touchAction: 'none' }}
      >
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={stopDrawing}
          onMouseLeave={stopDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={stopDrawing}
          onTouchCancel={stopDrawing}
          className="w-full cursor-crosshair block rounded-lg border border-slate-200 bg-white"
          style={{ touchAction: 'none' }}
        />

        {/* Guia visual de ajuda quando vazio */}
        {!hasDrawn && (
          <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none text-slate-400">
            <PenTool className="w-6 h-6 mb-1 text-slate-300 animate-bounce" />
            <p className="text-xs font-semibold text-slate-400">
              Assine com o dedo ou caneta nesta área
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons Bar */}
      <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={handleClear}
          disabled={!hasDrawn || saving}
          className="flex items-center gap-1.5 px-3.5 py-2.5 rounded-xl border border-slate-300 bg-white text-slate-700 font-bold text-xs hover:bg-slate-100 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
        >
          <RotateCcw className="w-4 h-4 text-slate-500" />
          <span>Limpar</span>
        </button>

        <div className="flex items-center gap-2">
          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              disabled={saving}
              className="px-3.5 py-2.5 rounded-xl text-slate-600 font-bold text-xs hover:bg-slate-200/60 active:scale-95 transition-all min-h-[44px]"
            >
              Cancelar
            </button>
          )}

          <button
            type="button"
            onClick={handleConfirm}
            disabled={!hasDrawn || saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-xl bg-greenSuccess-600 hover:bg-greenSuccess-700 text-white font-black text-xs sm:text-sm shadow-md shadow-emerald-700/30 active:scale-95 transition-all disabled:opacity-40 disabled:pointer-events-none min-h-[44px]"
          >
            {saving ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Enviando...</span>
              </>
            ) : (
              <>
                <Check className="w-4 h-4" />
                <span>Confirmar Assinatura</span>
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
};
