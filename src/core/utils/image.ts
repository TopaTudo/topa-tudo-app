/**
 * Utilitário de Compressão Client-Side de Imagens via Canvas
 * Topa Tudo - Alta performance, baixa latência móvel e economia de storage
 */

export interface CompressionResult {
  file: File;
  originalSize: number;
  compressedSize: number;
  savedPercentage: number;
  width: number;
  height: number;
  format: 'webp' | 'jpeg';
}

/**
 * Formata bytes em string legível (ex: 3.2 MB, 240 KB)
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes <= 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Detecta se o navegador suporta exportação direta para image/webp no Canvas
 */
let cachedWebpSupport: boolean | null = null;
function supportsWebP(): boolean {
  if (cachedWebpSupport !== null) return cachedWebpSupport;
  if (typeof document === 'undefined') return false;
  try {
    const canvas = document.createElement('canvas');
    canvas.width = 1;
    canvas.height = 1;
    cachedWebpSupport = canvas.toDataURL('image/webp').indexOf('data:image/webp') === 0;
  } catch {
    cachedWebpSupport = false;
  }
  return cachedWebpSupport;
}

/**
 * Redimensiona e comprime uma foto no cliente com telemetria detalhada de economia.
 * Suporta fotos verticais e horizontais limitando a maior dimensão a maxDimension.
 * Utiliza URL.createObjectURL para evitar estouro de memória RAM em smartphones.
 *
 * @param file Arquivo de imagem original
 * @param maxDimension Dimensão máxima (largura ou altura, default: 1600px)
 * @param quality Qualidade de compressão (default: 0.82)
 */
export async function compressImageWithStats(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<CompressionResult> {
  const originalSize = file.size;

  // Se não for imagem suportada, retorna o arquivo original sem alteração
  if (!file.type || !file.type.startsWith('image/')) {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      width: 0,
      height: 0,
      format: 'jpeg',
    };
  }

  // GIFs ou SVGs não devem passar por rasterização em JPEG/WebP
  if (file.type === 'image/gif' || file.type === 'image/svg+xml') {
    return {
      file,
      originalSize,
      compressedSize: originalSize,
      savedPercentage: 0,
      width: 0,
      height: 0,
      format: 'jpeg',
    };
  }

  return new Promise((resolve) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savedPercentage: 0,
        width: 0,
        height: 0,
        format: 'jpeg',
      });
      return;
    }

    const objectUrl = URL.createObjectURL(file);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(objectUrl);

      let width = img.naturalWidth || img.width;
      let height = img.naturalHeight || img.height;

      // Limita a maior dimensão (largura ou altura) preservando o aspect ratio
      const maxDim = Math.max(width, height);
      if (maxDim > maxDimension && maxDim > 0) {
        const ratio = maxDimension / maxDim;
        width = Math.round(width * ratio);
        height = Math.round(height * ratio);
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d', { alpha: false });
      if (!ctx) {
        resolve({
          file,
          originalSize,
          compressedSize: originalSize,
          savedPercentage: 0,
          width,
          height,
          format: 'jpeg',
        });
        return;
      }

      // Fundo branco sólido para prevenir artefatos pretos em PNGs com transparência
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      // Suavização bilinear de alta qualidade
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = 'high';
      ctx.drawImage(img, 0, 0, width, height);

      const targetFormat: 'webp' | 'jpeg' = supportsWebP() ? 'webp' : 'jpeg';
      const mimeType = targetFormat === 'webp' ? 'image/webp' : 'image/jpeg';
      const extension = targetFormat === 'webp' ? 'webp' : 'jpg';

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savedPercentage: 0,
              width,
              height,
              format: 'jpeg',
            });
            return;
          }

          // Se a imagem comprimida for maior que a original (raro, mas possível em imagens minúsculas), mantém a original
          if (blob.size >= originalSize && originalSize > 0 && maxDim <= maxDimension) {
            resolve({
              file,
              originalSize,
              compressedSize: originalSize,
              savedPercentage: 0,
              width,
              height,
              format: targetFormat,
            });
            return;
          }

          const baseName = file.name.replace(/\.[^.]+$/, '');
          const compressedFileName = `${baseName}.${extension}`;

          const compressedFile = new File([blob], compressedFileName, {
            type: mimeType,
            lastModified: Date.now(),
          });

          const compressedSize = blob.size;
          const savedPercentage =
            originalSize > 0
              ? Math.max(0, Math.round(((originalSize - compressedSize) / originalSize) * 100))
              : 0;

          resolve({
            file: compressedFile,
            originalSize,
            compressedSize,
            savedPercentage,
            width,
            height,
            format: targetFormat,
          });
        },
        mimeType,
        quality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      resolve({
        file,
        originalSize,
        compressedSize: originalSize,
        savedPercentage: 0,
        width: 0,
        height: 0,
        format: 'jpeg',
      });
    };

    img.src = objectUrl;
  });
}

/**
 * Versão compatível que retorna diretamente o File comprimido
 */
export async function compressImage(
  file: File,
  maxDimension = 1600,
  quality = 0.82
): Promise<File> {
  const result = await compressImageWithStats(file, maxDimension, quality);
  return result.file;
}
