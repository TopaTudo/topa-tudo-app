-- ==============================================================================
-- Migração 005: Payment Terms and Duplicata Support
-- Descrição:
-- 1. Adicionar colunas de pagamento (pix/prazo) e due_date em orders.
-- 2. Adicionar colunas de status de pagamento e due_date em transactions.
-- 3. Criar índices para otimização de recebimentos.
-- 4. Atualizar RPC complete_work_order para suportar fluxo de duplicatas ('prazo').
-- ==============================================================================

-- 1. Alterar public.orders
ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'pix';

ALTER TABLE public.orders DROP CONSTRAINT IF EXISTS orders_payment_method_check;
ALTER TABLE public.orders ADD CONSTRAINT orders_payment_method_check CHECK (payment_method IN ('pix', 'prazo', 'a_combinar'));

ALTER TABLE public.orders 
ADD COLUMN IF NOT EXISTS due_date DATE NULL;

-- 2. Alterar public.transactions
ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS due_date DATE NULL;

ALTER TABLE public.transactions 
ADD COLUMN IF NOT EXISTS payment_status TEXT NOT NULL DEFAULT 'pago' CHECK (payment_status IN ('pago', 'pendente'));

-- 3. Índices para Próximos Recebimentos
CREATE INDEX IF NOT EXISTS idx_transactions_payment_status_due_date ON public.transactions(payment_status, due_date);

-- 4. Atualizar RPC complete_work_order
CREATE OR REPLACE FUNCTION public.complete_work_order(p_order_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_order public.orders%ROWTYPE;
    v_item RECORD;
    v_items_count INTEGER := 0;
    v_tx_created BOOLEAN := false;
BEGIN
    -- Seleciona a OS com lock pessimista
    SELECT * INTO v_order
    FROM public.orders
    WHERE id = p_order_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Ordem de serviço não encontrada: %', p_order_id;
    END IF;

    -- Bloquear conclusão de OS cancelada
    IF v_order.status = 'cancelado' THEN
        RAISE EXCEPTION 'Não é permitido concluir uma ordem de serviço cancelada.';
    END IF;

    -- Se já estiver concluída, retorna sucesso informativo sem duplicar nada
    IF v_order.status = 'concluido' THEN
        RETURN jsonb_build_object(
            'success', true,
            'message', 'Ordem de serviço já está concluída',
            'order_id', p_order_id,
            'items_deducted', 0,
            'transaction_created', false
        );
    END IF;

    -- 1. Atualizar status e timestamp de conclusão da OS
    UPDATE public.orders
    SET status = 'concluido',
        completed_at = COALESCE(completed_at, now())
    WHERE id = p_order_id;

    -- 2. Percorrer itens da OS com source = 'estoque' e material_id válido para registrar saída
    -- Idempotência: só inserir se NÃO existirem saídas já registradas para esta OS
    IF NOT EXISTS (
        SELECT 1 FROM public.inventory_movements 
        WHERE order_id = p_order_id AND type = 'saida'
    ) THEN
        FOR v_item IN 
            SELECT id, material_id, quantity, name
            FROM public.order_items
            WHERE order_id = p_order_id
              AND source = 'estoque'
              AND material_id IS NOT NULL
        LOOP
            INSERT INTO public.inventory_movements (
                material_id,
                type,
                quantity,
                order_id,
                notes
            ) VALUES (
                v_item.material_id,
                'saida',
                v_item.quantity,
                p_order_id,
                'Baixa automática via conclusão da OS #' || COALESCE(v_order.code::text, '') || ' (' || v_item.name || ')'
            );
            v_items_count := v_items_count + 1;
        END LOOP;
    END IF;

    -- 3. Se a OS possui valor total > 0, gerar lançamento em transactions (receita)
    -- Idempotência: só inserir se NÃO existir receita já registrada para esta OS
    IF v_order.total_price IS NOT NULL AND v_order.total_price > 0 THEN
        IF NOT EXISTS (
            SELECT 1 FROM public.transactions 
            WHERE order_id = p_order_id AND type = 'receita'
        ) THEN
            IF v_order.payment_method IN ('prazo', 'a_combinar') THEN
                INSERT INTO public.transactions (
                    type,
                    amount,
                    description,
                    category,
                    payment_status,
                    due_date,
                    order_id,
                    date
                ) VALUES (
                    'receita',
                    v_order.total_price,
                    'Duplicata OS #' || LPAD(v_order.code::text, 4, '0'),
                    'Serviço',
                    'pendente',
                    COALESCE(v_order.due_date, CURRENT_DATE + INTERVAL '30 days'),
                    p_order_id,
                    CURRENT_DATE
                );
            ELSE
                INSERT INTO public.transactions (
                    type,
                    amount,
                    description,
                    category,
                    payment_status,
                    due_date,
                    order_id,
                    date
                ) VALUES (
                    'receita',
                    v_order.total_price,
                    'Receita OS #' || LPAD(v_order.code::text, 4, '0'),
                    'Serviço',
                    'pago',
                    CURRENT_DATE,
                    p_order_id,
                    CURRENT_DATE
                );
            END IF;
            v_tx_created := true;
        END IF;
    END IF;

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'items_deducted', v_items_count,
        'transaction_created', v_tx_created
    );
END;
$$;
