-- ==============================================================================
-- Migração Inicial: Schema Completo Topa Tudo
-- Descrição: Tabelas, Views, Funções RPC, Storage Bucket e Seed Data
-- ==============================================================================

-- 1. EXTENSÕES
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABELAS
-- ==============================================================================

-- 2.1 PROFILES (Usuários / Técnicos / Administradores)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT,
    pin TEXT CHECK (pin ~ '^[0-9]{4}$'),
    role TEXT CHECK (role IN ('adm', 'tecnico')),
    active BOOLEAN DEFAULT true,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.2 CLIENTS (Clientes)
CREATE TABLE IF NOT EXISTS public.clients (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name TEXT NOT NULL,
    phone TEXT,
    address TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.3 SERVICES_CATALOG (Catálogo de Serviços)
CREATE TABLE IF NOT EXISTS public.services_catalog (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title TEXT NOT NULL,
    category TEXT,
    default_price NUMERIC(10,2) DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.4 INVENTORY (Inventário / Materiais)
CREATE TABLE IF NOT EXISTS public.inventory (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    unit TEXT DEFAULT 'un',
    min_stock NUMERIC(10,2) DEFAULT 0,
    max_stock NUMERIC(10,2) DEFAULT 0,
    cost_price NUMERIC(10,2) DEFAULT 0,
    supplier TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.5 ORDERS (Ordens de Serviço)
CREATE TABLE IF NOT EXISTS public.orders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code SERIAL UNIQUE,
    client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
    tech_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    status TEXT CHECK (status IN ('orcamento', 'agendado', 'em_andamento', 'concluido', 'cancelado')) DEFAULT 'orcamento',
    address TEXT,
    description TEXT,
    total_price NUMERIC(10,2) DEFAULT 0,
    payment_method TEXT,
    warranty_days INTEGER DEFAULT 90,
    photos_before TEXT[] DEFAULT '{}',
    photos_after TEXT[] DEFAULT '{}',
    scheduled_at TIMESTAMPTZ,
    completed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.6 INVENTORY_MOVEMENTS (Movimentações de Estoque)
CREATE TABLE IF NOT EXISTS public.inventory_movements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    material_id UUID REFERENCES public.inventory(id) ON DELETE CASCADE,
    type TEXT CHECK (type IN ('entrada', 'saida')),
    quantity NUMERIC(10,2) NOT NULL,
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.7 ORDER_ITEMS (Itens / Peças da Ordem de Serviço)
CREATE TABLE IF NOT EXISTS public.order_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    order_id UUID REFERENCES public.orders(id) ON DELETE CASCADE,
    material_id UUID REFERENCES public.inventory(id) ON DELETE SET NULL,
    name TEXT NOT NULL,
    quantity NUMERIC(10,2) NOT NULL DEFAULT 1,
    unit_cost NUMERIC(10,2) DEFAULT 0,
    source TEXT CHECK (source IN ('estoque', 'comprado')) DEFAULT 'estoque'
);

-- 2.8 TRANSACTIONS (Financeiro: Receitas e Despesas)
CREATE TABLE IF NOT EXISTS public.transactions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type TEXT CHECK (type IN ('receita', 'despesa')),
    amount NUMERIC(10,2) NOT NULL,
    description TEXT NOT NULL,
    category TEXT,
    status TEXT CHECK (status IN ('confirmado', 'pendente')) DEFAULT 'confirmado',
    order_id UUID REFERENCES public.orders(id) ON DELETE SET NULL,
    attachment_url TEXT,
    date DATE DEFAULT CURRENT_DATE,
    created_at TIMESTAMPTZ DEFAULT now()
);

-- 2.9 TOOLS (Ferramentas)
CREATE TABLE IF NOT EXISTS public.tools (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    status TEXT CHECK (status IN ('disponivel', 'emprestada', 'manutencao')) DEFAULT 'disponivel',
    assigned_to_tech_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    notes TEXT,
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 2.10 SCHEDULE (Agendamentos)
CREATE TABLE IF NOT EXISTS public.schedule (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    date DATE NOT NULL,
    start_time TEXT,
    end_time TEXT,
    client_id UUID REFERENCES public.clients(id) ON DELETE CASCADE,
    tech_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
    description TEXT,
    status TEXT DEFAULT 'agendado',
    created_at TIMESTAMPTZ DEFAULT now()
);

-- ==============================================================================
-- 3. ÍNDICES DE PERFORMANCE
-- ==============================================================================
CREATE INDEX IF NOT EXISTS idx_orders_client_id ON public.orders(client_id);
CREATE INDEX IF NOT EXISTS idx_orders_tech_id ON public.orders(tech_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON public.orders(status);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_material_id ON public.inventory_movements(material_id);
CREATE INDEX IF NOT EXISTS idx_inventory_movements_order_id ON public.inventory_movements(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_order_id ON public.order_items(order_id);
CREATE INDEX IF NOT EXISTS idx_order_items_material_id ON public.order_items(material_id);
CREATE INDEX IF NOT EXISTS idx_transactions_order_id ON public.transactions(order_id);
CREATE INDEX IF NOT EXISTS idx_transactions_date ON public.transactions(date);
CREATE INDEX IF NOT EXISTS idx_tools_assigned_to_tech_id ON public.tools(assigned_to_tech_id);
CREATE INDEX IF NOT EXISTS idx_schedule_date ON public.schedule(date);
CREATE INDEX IF NOT EXISTS idx_schedule_tech_id ON public.schedule(tech_id);

-- ==============================================================================
-- 4. VIEW PARA SALDO DE ESTOQUE DINÂMICO
-- ==============================================================================
CREATE OR REPLACE VIEW public.v_inventory_stock AS
SELECT 
    i.id,
    i.code,
    i.name,
    i.category,
    i.unit,
    i.min_stock,
    i.max_stock,
    i.cost_price,
    i.supplier,
    i.notes,
    i.created_at,
    COALESCE(SUM(CASE WHEN m.type = 'entrada' THEN m.quantity ELSE 0 END), 0)::NUMERIC(10,2) AS entradas,
    COALESCE(SUM(CASE WHEN m.type = 'saida' THEN m.quantity ELSE 0 END), 0)::NUMERIC(10,2) AS saidas,
    (COALESCE(SUM(CASE WHEN m.type = 'entrada' THEN m.quantity ELSE 0 END), 0) - 
     COALESCE(SUM(CASE WHEN m.type = 'saida' THEN m.quantity ELSE 0 END), 0))::NUMERIC(10,2) AS saldo_atual
FROM public.inventory i
LEFT JOIN public.inventory_movements m ON i.id = m.material_id
GROUP BY 
    i.id, i.code, i.name, i.category, i.unit, 
    i.min_stock, i.max_stock, i.cost_price, i.supplier, i.notes, i.created_at;

-- ==============================================================================
-- 5. STORED PROCEDURE (RPC): complete_work_order
-- ==============================================================================
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

    -- Se já estiver concluída, evita duplicidade de baixa de estoque e receitas
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
        completed_at = now()
    WHERE id = p_order_id;

    -- 2. Percorrer itens da OS com source = 'estoque' e material_id válido para registrar saída
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

    -- 3. Se a OS possui valor total > 0, gerar lançamento em transactions (receita)
    IF v_order.total_price IS NOT NULL AND v_order.total_price > 0 THEN
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

    RETURN jsonb_build_object(
        'success', true,
        'order_id', p_order_id,
        'items_deducted', v_items_count,
        'transaction_created', v_tx_created
    );
END;
$$;

-- Permissões de execução para a RPC
GRANT EXECUTE ON FUNCTION public.complete_work_order(UUID) TO anon, authenticated, service_role;

-- ==============================================================================
-- 6. CONFIGURAÇÃO DE SEGURANÇA (RLS & PERMISSÕES)
-- ==============================================================================

-- Habilitar RLS em todas as tabelas
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.orders ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.inventory_movements ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.order_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.transactions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule ENABLE ROW LEVEL SECURITY;

-- Políticas de acesso permissivo para anon e authenticated (aplicativo interno Topa Tudo)
DROP POLICY IF EXISTS "Allow all for anon and auth on profiles" ON public.profiles;
CREATE POLICY "Allow all for anon and auth on profiles" ON public.profiles FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on clients" ON public.clients;
CREATE POLICY "Allow all for anon and auth on clients" ON public.clients FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on services_catalog" ON public.services_catalog;
CREATE POLICY "Allow all for anon and auth on services_catalog" ON public.services_catalog FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on inventory" ON public.inventory;
CREATE POLICY "Allow all for anon and auth on inventory" ON public.inventory FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on orders" ON public.orders;
CREATE POLICY "Allow all for anon and auth on orders" ON public.orders FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on inventory_movements" ON public.inventory_movements;
CREATE POLICY "Allow all for anon and auth on inventory_movements" ON public.inventory_movements FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on order_items" ON public.order_items;
CREATE POLICY "Allow all for anon and auth on order_items" ON public.order_items FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on transactions" ON public.transactions;
CREATE POLICY "Allow all for anon and auth on transactions" ON public.transactions FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on tools" ON public.tools;
CREATE POLICY "Allow all for anon and auth on tools" ON public.tools FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "Allow all for anon and auth on schedule" ON public.schedule;
CREATE POLICY "Allow all for anon and auth on schedule" ON public.schedule FOR ALL TO anon, authenticated USING (true) WITH CHECK (true);

-- Permissões gerais para anon e authenticated
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL ROUTINES IN SCHEMA public TO anon, authenticated, service_role;

-- ==============================================================================
-- 7. STORAGE BUCKET: topatudo-media
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'topatudo-media',
    'topatudo-media',
    true,
    52428800, -- 50MB
    ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic', 'image/jpg']
)
ON CONFLICT (id) DO UPDATE 
SET public = true,
    file_size_limit = EXCLUDED.file_size_limit,
    allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Políticas de Storage para o bucket topatudo-media
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Access to topatudo-media'
    ) THEN
        CREATE POLICY "Public Access to topatudo-media"
        ON storage.objects FOR SELECT
        TO anon, authenticated
        USING (bucket_id = 'topatudo-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Insert to topatudo-media'
    ) THEN
        CREATE POLICY "Public Insert to topatudo-media"
        ON storage.objects FOR INSERT
        TO anon, authenticated
        WITH CHECK (bucket_id = 'topatudo-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Update to topatudo-media'
    ) THEN
        CREATE POLICY "Public Update to topatudo-media"
        ON storage.objects FOR UPDATE
        TO anon, authenticated
        USING (bucket_id = 'topatudo-media');
    END IF;

    IF NOT EXISTS (
        SELECT 1 FROM pg_policies 
        WHERE schemaname = 'storage' 
          AND tablename = 'objects' 
          AND policyname = 'Public Delete to topatudo-media'
    ) THEN
        CREATE POLICY "Public Delete to topatudo-media"
        ON storage.objects FOR DELETE
        TO anon, authenticated
        USING (bucket_id = 'topatudo-media');
    END IF;
END $$;

-- ==============================================================================
-- 8. DADOS SEMENTE (SEED DATA)
-- ==============================================================================

-- 8.1 Perfis Iniciais
INSERT INTO public.profiles (name, role, pin, active)
SELECT 'Administrador', 'adm', '1234', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = 'Administrador' AND role = 'adm'
);

INSERT INTO public.profiles (name, role, pin, active)
SELECT 'Técnico Geral', 'tecnico', '0000', true
WHERE NOT EXISTS (
    SELECT 1 FROM public.profiles WHERE name = 'Técnico Geral' AND role = 'tecnico'
);

-- 8.2 Catálogo Padrão de Serviços
INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Troca de Chuveiro', 'Elétrica', 120.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Troca de Chuveiro'
);

INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Instalação de Tomada', 'Elétrica', 60.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Instalação de Tomada'
);

INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Reparo Hidráulico', 'Hidráulica', 150.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Reparo Hidráulico'
);

INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Desentupimento de Ralo/Pia', 'Hidráulica', 130.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Desentupimento de Ralo/Pia'
);

INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Instalação de Ventilador de Teto', 'Elétrica', 160.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Instalação de Ventilador de Teto'
);

INSERT INTO public.services_catalog (title, category, default_price)
SELECT 'Pintura e Retoque de Paredes', 'Pintura', 180.00
WHERE NOT EXISTS (
    SELECT 1 FROM public.services_catalog WHERE title = 'Pintura e Retoque de Paredes'
);
