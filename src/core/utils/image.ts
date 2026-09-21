/**
 * Utilitário de Compressão Client-Side de Imagens via Canvas
 */

/**
 * Redimensiona e comprime uma foto no cliente antes do envio ao Supabase Storage.
 * Reduz fotos de alta resolução de smartphones (5MB-15MB) para cerca de ~200KB-400KB,
 * acelerando o upload em redes móveis e economizando espaço no Storage.
 *
 * @param file Arquivo de imagem original
 * @param maxWidth Largura máxima permitida (default: 1600px)
 * @param quality Qualidade do JPEG entre 0.1 e 1.0 (default: 0.8)
 */
export async function compressImage(
  file: File,
  maxWidth = 1600,
  quality = 0.8
): Promise<File> {
  // Se não for uma imagem suportada para decodificação em canvas, retorna o arquivo original
  if (!file.type.startsWith('image/')) {
    return file;
  }

  return new Promise((resolve) => {
    const reader = new FileReader();

    reader.onload = (readerEvent) => {
      const img = new Image();

      img.onload = () => {
        let width = img.width;
        let height = img.height;

        // Se a largura for maior que o limite, redimensiona mantendo a proporção
        if (width > maxWidth) {
          const ratio = maxWidth / width;
          width = maxWidth;
          height = Math.round(height * ratio);
        }

        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;

        const ctx = canvas.getContext('2d');
        if (!ctx) {
          // Se não conseguir contexto 2d (ambiente headless/testes), retorna arquivo original
          resolve(file);
          return;
        }

        // Desenha a imagem redimensionada
        ctx.drawImage(img, 0, 0, width, height);

        // Exporta como JPEG com a qualidade definida
        canvas.toBlob(
          (blob) => {
            if (!blob) {
              resolve(file);
              return;
            }

            // Normaliza o nome para extensão .jpg
            const baseName = file.name.replace(/\.[^.]+$/, '');
            const compressedFileName = `${baseName}.jpg`;

            const compressedFile = new File([blob], compressedFileName, {
              type: 'image/jpeg',
              lastModified: Date.now(),
            });

            resolve(compressedFile);
          },
          'image/jpeg',
          quality
        );
      };

      img.onerror = () => {
        // Se falhar ao carregar no Image(), retorna o arquivo original
        resolve(file);
      };

      if (typeof readerEvent.target?.result === 'string') {
        img.src = readerEvent.target.result;
      } else {
        resolve(file);
      }
    };

    reader.onerror = () => {
      resolve(file);
    };

    reader.readAsDataURL(file);
  });
}
