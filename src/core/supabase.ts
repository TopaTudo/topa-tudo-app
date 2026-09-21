import { createClient } from '@supabase/supabase-js';
import type { CompleteOrderResult } from './types/database';

export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL || 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';
export const STORAGE_BUCKET = 'topatudo-media';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
  },
});

/**
 * Retorna a URL pública de uma foto armazenada no bucket topatudo-media
 */
export function getStoragePublicUrl(filePath: string): string {
  if (!filePath) return '';
  if (filePath.startsWith('http://') || filePath.startsWith('https://')) {
    return filePath;
  }
  const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(filePath);
  return data.publicUrl;
}

/**
 * Realiza o upload de uma imagem (File ou Blob) diretamente para o Supabase Storage
 */
export async function uploadMedia(file: File | Blob, folder = 'os'): Promise<string> {
  const ext = file.type ? file.type.split('/')[1] || 'jpg' : 'jpg';
  const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(2, 8)}.${ext}`;

  const { data, error } = await supabase.storage
    .from(STORAGE_BUCKET)
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || 'image/jpeg',
    });

  if (error) {
    throw new Error(`Erro ao enviar foto: ${error.message}`);
  }

  return getStoragePublicUrl(data.path);
}

/**
 * Executa a RPC atômica complete_work_order
 */
export async function completeWorkOrderRPC(orderId: string): Promise<CompleteOrderResult> {
  const { data, error } = await supabase.rpc('complete_work_order', {
    p_order_id: orderId,
  });

  if (error) {
    throw new Error(error.message);
  }

  return data as CompleteOrderResult;
}
