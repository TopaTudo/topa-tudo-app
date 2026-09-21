-- ==============================================================================
-- Migração 002: Correções de Regras de Negócio e Segurança de PIN
-- Descrição:
-- 1. Atualizar RPC complete_work_order com bloqueio de OS cancelada e idempotência total
-- 2. Hashing seguro de PINs com pgcrypto e trigger automático
-- 3. Adicionar RPC verify_user_pin para validação segura de credenciais
-- 4. Criar view pública v_profiles sem exposição da coluna de PIN
-- ==============================================================================

-- 1. Garantir extensão pgcrypto
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- 2. Atualizar tabela profiles e hashing de PINs
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_pin_check;

-- Função trigger para hashear PINs de 4 dígitos antes de inserir/atualizar
CREATE OR REPLACE FUNCTION public.trg_hash_profile_pin()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.pin IS NOT NULL AND NEW.pin ~ '^[0-9]{4}$' THEN
        NEW.pin := crypt(NEW.pin, gen_salt('bf', 8));
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_profiles_hash_pin ON public.profiles;
CREATE TRIGGER trg_profiles_hash_pin
BEFORE INSERT OR UPDATE OF pin ON public.profiles
FOR EACH ROW
EXECUTE FUNCTION public.trg_hash_profile_pin();

-- Hashear PINs existentes que ainda estejam em texto plano
UPDATE public.profiles
SET pin = crypt(pin, gen_salt('bf', 8))
WHERE pin IS NOT NULL AND pin ~ '^[0-9]{4}$';

-- 3. View pública de perfis sem a coluna pin
CREATE OR REPLACE VIEW public.v_profiles AS
SELECT 
    id, 
    name, 
    role, 
    active, 
    created_at
FROM public.profiles;

GRANT SELECT ON public.v_profiles TO anon, authenticated, service_role;

-- 4. RPC segura de verificação de PIN
CREATE OR REPLACE FUNCTION public.verify_user_pin(p_user_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_stored_pin TEXT;
BEGIN
    SELECT pin INTO v_stored_pin
    FROM public.profiles
    WHERE id = p_user_id AND active = true;

    IF v_stored_pin IS NULL OR p_pin IS NULL THEN
        RETURN FALSE;
    END IF;

    -- Se o PIN estiver hasheado com bcrypt ($2a$ ou $2b$)
    IF v_stored_pin LIKE '$2%' THEN
        RETURN v_stored_pin = crypt(p_pin, v_stored_pin);
    ELSE
        RETURN v_stored_pin = p_pin;
    END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.verify_user_pin(UUID, TEXT) TO anon, authenticated, service_role;

-- 5. Atualizar RPC complete_work_order
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
            INSERT INTO public.transactions (
                type,
                amount,
                description,
                category,
                status,
                order_id,
                date
            ) VALUES (
                'receita',
                v_order.total_price,
                'Receita referente à OS #' || COALESCE(v_order.code::text, ''),
                'Serviço',
                'confirmado',
                p_order_id,
                CURRENT_DATE
            );
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

GRANT EXECUTE ON FUNCTION public.complete_work_order(UUID) TO anon, authenticated, service_role;
