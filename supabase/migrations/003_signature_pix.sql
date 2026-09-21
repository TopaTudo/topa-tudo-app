-- ==============================================================================
-- Migração 003: Assinatura Digital do Cliente e Metadados PIX
-- Descrição:
-- 1. Adiciona coluna signature_url na tabela orders para armazenar o link
--    público da assinatura digital capturada no mobile e salva no Supabase Storage.
-- ==============================================================================

-- Adiciona a coluna signature_url se não existir
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS signature_url TEXT;

COMMENT ON COLUMN public.orders.signature_url IS 'URL da imagem PNG da assinatura digital do cliente coletada no pad touch/mobile';
