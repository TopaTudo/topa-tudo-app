-- ==============================================================================
-- Migração 006: Sincronização Bidirecional entre Agenda (schedule) e OS (orders)
-- Descrição:
-- 1. Adicionar coluna order_id na tabela public.schedule referenciando public.orders(id).
-- 2. Criar índice para busca rápida de agendamentos por order_id.
-- 3. Atualizar RPC complete_work_order para também concluir o agendamento vinculado.
-- ==============================================================================

-- 1. Adicionar order_id em public.schedule
ALTER TABLE public.schedule
ADD COLUMN IF NOT EXISTS order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE;

-- 2. Índice para performance de join e lookup
CREATE INDEX IF NOT EXISTS idx_schedule_order_id ON public.schedule(order_id);

-- 3. Atualizar RPC complete_work_order mantendo todas as regras e sincronizando a agenda
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

    -- 1.1 Sincronizar status na agenda (schedule) caso exista agendamento vinculado
    UPDATE public.schedule
    SET status = 'concluido'
    WHERE order_id = p_order_id;

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
