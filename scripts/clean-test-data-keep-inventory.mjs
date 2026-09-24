/**
 * Topa Tudo - Script de Limpeza de Dados de Teste Preservando Estoque
 * Arquivo: scripts/clean-test-data-keep-inventory.mjs
 * 
 * Executa a remoção atômica de dados gerados em testes (clientes, ordens,
 * itens, transações, agendamentos, ferramentas e saídas de estoque),
 * PRESERVANDO intactos:
 * - inventory (materiais cadastrados)
 * - inventory_movements (apenas type = 'entrada', garantindo o saldo positivo de estoque)
 * - profiles (perfis de usuário/técnico)
 * - services_catalog (catálogo de serviços)
 */

import pg from 'pg';
const { Client } = pg;

export const DB_CONFIGS = [
  {
    name: 'Pooler Session (port 5432 - IPv4)',
    conn: process.env.DATABASE_POOLER_URL || 'postgresql://postgres.nlnkwrfzqvhncwfuuogo:%40Edu99001628@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
    timeout: 10000
  },
  {
    name: 'Direct Connection (port 5432)',
    conn: process.env.DATABASE_URL || 'postgresql://postgres:%40Edu99001628@db.nlnkwrfzqvhncwfuuogo.supabase.co:5432/postgres',
    timeout: 5000
  },
  {
    name: 'Pooler Transaction (port 6543)',
    conn: process.env.DATABASE_POOLER_TX_URL || 'postgresql://postgres.nlnkwrfzqvhncwfuuogo:%40Edu99001628@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
    timeout: 10000
  }
];

export async function createDbClient() {
  for (const cfg of DB_CONFIGS) {
    try {
      const client = new Client({
        connectionString: cfg.conn,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: cfg.timeout
      });
      await client.connect();
      console.log(`[DB] Conectado via ${cfg.name}`);
      return client;
    } catch (err) {
      console.warn(`[DB] Rota ${cfg.name} indisponível: ${err.message}`);
    }
  }
  throw new Error('Falha ao conectar no PostgreSQL após tentar todas as rotas configuradas.');
}

async function getTableCounts(client) {
  const counts = {};
  const tables = [
    'clients',
    'orders',
    'order_items',
    'transactions',
    'schedule',
    'tools',
    'inventory',
    'profiles',
    'services_catalog'
  ];

  for (const table of tables) {
    const res = await client.query(`SELECT count(*)::int AS count FROM ${table}`);
    counts[table] = res.rows[0].count;
  }

  const movRes = await client.query(`
    SELECT 
      count(*)::int AS total,
      count(*) FILTER (WHERE type = 'entrada')::int AS entradas,
      count(*) FILTER (WHERE type = 'saida')::int AS saidas
    FROM inventory_movements
  `);
  counts['inventory_movements'] = movRes.rows[0].total;
  counts['inventory_movements_entradas'] = movRes.rows[0].entradas;
  counts['inventory_movements_saidas'] = movRes.rows[0].saidas;

  return counts;
}

export async function cleanTestDataKeepInventory() {
  const client = await createDbClient();

  try {
    console.log('\n================================================================');
    console.log('🧹 TOPA TUDO - LIMPEZA DE DADOS DE TESTE (PRESERVANDO ESTOQUE)');
    console.log('================================================================\n');

    // 1. Contagem inicial (Antes)
    console.log('[1/4] Coletando contagem pré-limpeza...');
    const beforeCounts = await getTableCounts(client);
    console.log('--- CONTAGEM ANTES ---');
    console.table(beforeCounts);

    // 2. Executar transação de limpeza
    console.log('\n[2/4] Iniciando transação atômica (BEGIN; ... COMMIT;)...');
    await client.query('BEGIN');

    // 2.1 Excluir saídas de estoque vinculadas a testes/OSs
    const delMovSaidasRes = await client.query(`DELETE FROM inventory_movements WHERE type = 'saida' RETURNING id`);
    console.log(`-> Excluídas ${delMovSaidasRes.rowCount} movimentações de 'saida' do estoque.`);

    // 2.2 Excluir itens de ordens de serviço
    const delOrderItemsRes = await client.query(`DELETE FROM order_items RETURNING id`);
    console.log(`-> Excluídos ${delOrderItemsRes.rowCount} registros de order_items.`);

    // 2.3 Excluir ordens de serviço
    const delOrdersRes = await client.query(`DELETE FROM orders RETURNING id`);
    console.log(`-> Excluídas ${delOrdersRes.rowCount} ordens de serviço (orders).`);

    // 2.4 Excluir transações financeiras
    const delTxRes = await client.query(`DELETE FROM transactions RETURNING id`);
    console.log(`-> Excluídas ${delTxRes.rowCount} transações financeiras (transactions).`);

    // 2.5 Excluir agendamentos
    const delSchedRes = await client.query(`DELETE FROM schedule RETURNING id`);
    console.log(`-> Excluídos ${delSchedRes.rowCount} agendamentos (schedule).`);

    // 2.6 Excluir ferramentas de teste
    const delToolsRes = await client.query(`DELETE FROM tools RETURNING id`);
    console.log(`-> Excluídas ${delToolsRes.rowCount} ferramentas (tools).`);

    // 2.7 Excluir clientes de teste
    const delClientsRes = await client.query(`DELETE FROM clients RETURNING id`);
    console.log(`-> Excluídos ${delClientsRes.rowCount} clientes (clients).`);

    // Commit da transação
    await client.query('COMMIT');
    console.log('✅ Transação confirmada com sucesso (COMMIT).');

    // 3. Contagem pós-limpeza (Depois)
    console.log('\n[3/4] Verificando integridade e contagem pós-limpeza...');
    const afterCounts = await getTableCounts(client);
    console.log('--- CONTAGEM DEPOIS ---');
    console.table(afterCounts);

    // 4. Consulta ao Estoque via View v_inventory_stock
    console.log('\n[4/4] Consultando visão de saldo de estoque (v_inventory_stock)...');
    const stockRes = await client.query(`
      SELECT 
        code, 
        name, 
        category, 
        unit, 
        entradas, 
        saidas, 
        saldo_atual, 
        min_stock, 
        max_stock, 
        cost_price
      FROM v_inventory_stock
      ORDER BY code
    `);

    console.log(`\n📦 Saldo consolidado dos materiais (${stockRes.rows.length} materiais cadastrados):`);
    console.table(stockRes.rows);

    return {
      success: true,
      before: beforeCounts,
      after: afterCounts,
      stock: stockRes.rows
    };
  } catch (error) {
    console.error('❌ Erro durante a limpeza de dados:', error);
    try {
      await client.query('ROLLBACK');
      console.log('⚠️ Transação revertida com ROLLBACK.');
    } catch (rbErr) {
      console.error('Erro ao executar rollback:', rbErr);
    }
    throw error;
  } finally {
    await client.end();
    console.log('[DB] Conexão encerrada.');
  }
}

// Execução direta via CLI
if (process.argv[1] && process.argv[1].endsWith('clean-test-data-keep-inventory.mjs')) {
  cleanTestDataKeepInventory()
    .then(() => {
      console.log('\n✨ Processo de limpeza concluído com êxito!');
      process.exit(0);
    })
    .catch((err) => {
      console.error('\n💥 Falha na execução da limpeza:', err);
      process.exit(1);
    });
}
