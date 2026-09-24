-- ==============================================================================
-- Migração 004: Índices Adicionais de Alta Performance para Carga e Escala
-- Descrição:
-- 1. idx_orders_created_at: Acelera ordenação decrescente de listagem de OSs
-- 2. idx_orders_completed_at: Otimiza agregações e relatórios mensais de faturamento
-- 3. idx_transactions_type_status: Acelera filtros combinados no dashboard e financeiro
-- 4. idx_inventory_movements_mat_type: Otimiza agregação de saldo da view v_inventory_stock
-- ==============================================================================

CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_orders_completed_at ON public.orders(completed_at DESC);
CREATE INDEX IF NOT EXISTS idx_transactions_type_status ON public.transactions(type, status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_mat_type ON public.inventory_movements(material_id, type);
