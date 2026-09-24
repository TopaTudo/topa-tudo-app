/**
 * Topa Tudo - Bateria Completa de Testes de Carga, Concorrência e QA
 * Arquivo: tests/run-load-test-battery.mjs
 * 
 * Executa as 5 baterias de testes de carga e integridade:
 * 1. Teste de Carga 1: Desempenho da View v_inventory_stock (10 iterações, min/méd/max)
 * 2. Teste de Carga 2: Conclusão Concorrente de 5 OSs via RPC complete_work_order (locks, idempotência, integridade)
 * 3. Teste de Carga 3: Consultas Agregadas de Dashboard & Financeiro (mês atual e meses passados)
 * 4. Teste de Carga 4: Filtros e Busca Textual de Ordens de Serviço (ILIKE, joins, status)
 * 5. Teste de Carga 5: Exportação de Relatório CSV com Volume Real (sanitização, injeção de fórmula, tempo)
 */

import { performance } from 'perf_hooks';
import pg from 'pg';
const { Client } = pg;
import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';

const POOLER_URL = process.env.DATABASE_POOLER_URL || 'postgresql://postgres.nlnkwrfzqvhncwfuuogo:%40Edu99001628@aws-0-us-east-2.pooler.supabase.com:5432/postgres';

function sanitizeCsvCell(val) {
  if (val === null || val === undefined) return '""';
  let str = String(val);
  // Prevenir injeção de fórmulas no Excel/Calc (=, +, -, @, \t, \r)
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }
  str = str.replace(/"/g, '""');
  return `"${str}"`;
}

async function createPgClient() {
  const client = new Client({
    connectionString: POOLER_URL,
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 10000
  });
  await client.connect();
  return client;
}

export async function runLoadTestBattery() {
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false }
  });
  const pgClient = await createPgClient();

  const results = {
    test1_inventoryView: {},
    test2_concurrentRPC: {},
    test3_dashboardQueries: {},
    test4_searchAndFilter: {},
    test5_csvExport: {},
    explainPlans: {}
  };

  try {
    console.log('\n===============================================================');
    console.log('⚡ INICIANDO BATERIA DE TESTES DE CARGA E FLUXO OPERACIONAL');
    console.log('===============================================================\n');

    // =========================================================================
    // TESTE 1: Desempenho da View v_inventory_stock (10 consultas consecutivas)
    // =========================================================================
    console.log('▶ [TESTE 1] Medindo latência da View v_inventory_stock (10 iterações)...');
    const viewLatencies = [];
    let stockRowCount = 0;

    for (let i = 1; i <= 10; i++) {
      const t0 = performance.now();
      const res = await pgClient.query('SELECT * FROM public.v_inventory_stock ORDER BY name ASC');
      const t1 = performance.now();
      const latency = t1 - t0;
      viewLatencies.push(latency);
      stockRowCount = res.rows.length;
    }

    const minViewLat = Math.min(...viewLatencies);
    const maxViewLat = Math.max(...viewLatencies);
    const avgViewLat = viewLatencies.reduce((a, b) => a + b, 0) / viewLatencies.length;

    results.test1_inventoryView = {
      iterations: 10,
      totalRows: stockRowCount,
      minLatencyMs: minViewLat.toFixed(2),
      avgLatencyMs: avgViewLat.toFixed(2),
      maxLatencyMs: maxViewLat.toFixed(2),
      latencies: viewLatencies.map(l => Number(l.toFixed(2)))
    };
    console.log(`  ✔ Latência View v_inventory_stock: Mín = ${results.test1_inventoryView.minLatencyMs}ms | Méd = ${results.test1_inventoryView.avgLatencyMs}ms | Máx = ${results.test1_inventoryView.maxLatencyMs}ms (Registros: ${stockRowCount})`);

    // =========================================================================
    // TESTE 2: Conclusão Concorrente de 5 OSs via RPC complete_work_order
    // =========================================================================
    console.log('\n▶ [TESTE 2] Testando Conclusão Concorrente de 5 OSs (RPC complete_work_order)...');
    
    // Selecionar 5 OSs com status 'em_andamento'
    const targetOrdersRes = await pgClient.query(`
      SELECT o.id, o.code, o.status, o.total_price,
             (SELECT count(*) FROM order_items oi WHERE oi.order_id = o.id AND oi.source = 'estoque' AND oi.material_id IS NOT NULL) as stock_items_count
      FROM orders o
      WHERE o.status = 'em_andamento'
      ORDER BY o.code ASC
      LIMIT 5
    `);

    const targetOrders = targetOrdersRes.rows;
    if (targetOrders.length < 5) {
      throw new Error(`Necessário pelo menos 5 OSs em andamento para o teste de concorrência. Encontradas: ${targetOrders.length}`);
    }

    console.log(`  Identificadas 5 OSs em andamento: ${targetOrders.map(o => `#${o.code}`).join(', ')}`);

    // Coleta saldo de materiais antes da concorrência
    const preStockRes = await pgClient.query('SELECT id, name, saldo_atual FROM v_inventory_stock');
    const preStockMap = new Map(preStockRes.rows.map(r => [r.id, Number(r.saldo_atual)]));

    // Itens que serão baixados
    const itemsToDeductRes = await pgClient.query(`
      SELECT oi.material_id, sum(oi.quantity) as total_qty
      FROM order_items oi
      WHERE oi.order_id = ANY($1::uuid[]) AND oi.source = 'estoque' AND oi.material_id IS NOT NULL
      GROUP BY oi.material_id
    `, [targetOrders.map(o => o.id)]);
    const expectedDeductions = new Map(itemsToDeductRes.rows.map(r => [r.material_id, Number(r.total_qty)]));

    // Disparar 5 conclusões em paralelo usando conexões paralelas do pgClient ou supabase RPC
    console.log('  Disparando 5 chamadas simultâneas à RPC complete_work_order...');
    const t0Concurrent = performance.now();
    
    // Disparar simultaneamente via Promise.all usando clientes dedicados para concorrência real
    const concurrentClients = await Promise.all([
      createPgClient(),
      createPgClient(),
      createPgClient(),
      createPgClient(),
      createPgClient()
    ]);

    const concurrentPromises = targetOrders.map((ord, idx) => {
      const cli = concurrentClients[idx];
      return cli.query('SELECT public.complete_work_order($1::uuid) as result', [ord.id]);
    });

    const concurrentResults = await Promise.all(concurrentPromises);
    const t1Concurrent = performance.now();
    const concurrentDuration = t1Concurrent - t0Concurrent;

    // Fechar clientes concorrentes
    await Promise.all(concurrentClients.map(c => c.end()));

    // Validar resultados da conclusão
    const rpcOutputs = concurrentResults.map(r => r.rows[0].result);
    const allSucceeded = rpcOutputs.every(r => r.success === true);
    console.log(`  ✔ 5 OSs concluídas em concorrência em ${concurrentDuration.toFixed(2)}ms (Média por OS: ${(concurrentDuration / 5).toFixed(2)}ms). Todos responderam success=true: ${allSucceeded}`);

    // Testar IDEMPOTÊNCIA: Chamar novamente as 5 OSs já concluídas
    console.log('  Testando idempotência: Re-disparando RPC para as mesmas 5 OSs já concluídas...');
    const retryRes = await Promise.all(targetOrders.map(ord => 
      pgClient.query('SELECT public.complete_work_order($1::uuid) as result', [ord.id])
    ));
    const retryOutputs = retryRes.map(r => r.rows[0].result);
    const idempotentOk = retryOutputs.every(r => r.success === true && r.items_deducted === 0 && r.transaction_created === false);
    console.log(`  ✔ Idempotência garantida: ${idempotentOk} (nenhuma duplicação de itens deduzidos ou receitas)`);

    // Validar se status no banco foi atualizado para 'concluido'
    const checkOrdersRes = await pgClient.query(`
      SELECT id, code, status, completed_at FROM orders WHERE id = ANY($1::uuid[])
    `, [targetOrders.map(o => o.id)]);
    const allConcludedInDb = checkOrdersRes.rows.every(o => o.status === 'concluido' && o.completed_at !== null);

    // Validar se as receitas foram criadas exatamente 1 vez por OS
    const checkTxRes = await pgClient.query(`
      SELECT order_id, count(*) as count, sum(amount) as total
      FROM transactions
      WHERE order_id = ANY($1::uuid[]) AND type = 'receita'
      GROUP BY order_id
    `, [targetOrders.map(o => o.id)]);
    const allTxsCreatedOnce = checkTxRes.rows.length === 5 && checkTxRes.rows.every(r => Number(r.count) === 1);

    // Validar saldo pós-conclusão
    const postStockRes = await pgClient.query('SELECT id, name, saldo_atual FROM v_inventory_stock');
    const postStockMap = new Map(postStockRes.rows.map(r => [r.id, Number(r.saldo_atual)]));

    let stockDeductionExact = true;
    for (const [matId, expectedQty] of expectedDeductions.entries()) {
      const preQty = preStockMap.get(matId) || 0;
      const postQty = postStockMap.get(matId) || 0;
      if (preQty - postQty !== expectedQty) {
        console.warn(`Discrepância no material ${matId}: pre=${preQty}, post=${postQty}, esperado deduzir=${expectedQty}`);
        stockDeductionExact = false;
      }
    }

    results.test2_concurrentRPC = {
      concurrencyCount: 5,
      totalExecutionTimeMs: concurrentDuration.toFixed(2),
      avgTimePerCallMs: (concurrentDuration / 5).toFixed(2),
      allSucceeded,
      idempotencyVerified: idempotentOk,
      allOrdersMarkedConcluded: allConcludedInDb,
      singleTransactionPerOrder: allTxsCreatedOnce,
      inventoryDeductionExact: stockDeductionExact
    };
    console.log(`  ✔ Validação de integridade: Status Concluído=${allConcludedInDb}, Receitas Únicas=${allTxsCreatedOnce}, Saldo Estoque Exato=${stockDeductionExact}`);

    // =========================================================================
    // TESTE 3: Consultas Agregadas do Dashboard & Financeiro
    // =========================================================================
    console.log('\n▶ [TESTE 3] Testando Consultas Agregadas do Dashboard & Financeiro...');
    
    // Mês atual e meses passados
    const currentMonth = new Date().toISOString().substring(0, 7);
    const prevMonthDate = new Date();
    prevMonthDate.setMonth(prevMonthDate.getMonth() - 1);
    const prevMonth = prevMonthDate.toISOString().substring(0, 7);

    // Simulação 1: Carga total de Ordens + Clientes + Técnicos
    const t0DashOrders = performance.now();
    const dashOrdersRes = await pgClient.query(`
      SELECT o.id, o.code, o.status, o.total_price, o.payment_method, o.created_at, o.completed_at,
             c.name as client_name, p.name as tech_name
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN profiles p ON o.tech_id = p.id
      ORDER BY o.created_at DESC
    `);
    const t1DashOrders = performance.now();

    // Simulação 2: Carga de Transações
    const t0DashTx = performance.now();
    const dashTxRes = await pgClient.query(`
      SELECT id, type, amount, description, category, status, date, order_id
      FROM transactions
      ORDER BY date DESC
    `);
    const t1DashTx = performance.now();

    // Simulação 3: Agregação SQL Direta do Dashboard para o mês atual
    const t0DashAgg = performance.now();
    const dashAggRes = await pgClient.query(`
      SELECT 
        COUNT(CASE WHEN o.status = 'concluido' THEN 1 END) as completed_count,
        COUNT(CASE WHEN o.status = 'em_andamento' THEN 1 END) as in_progress_count,
        COUNT(CASE WHEN o.status = 'agendado' THEN 1 END) as scheduled_count,
        COUNT(CASE WHEN o.status = 'orcamento' THEN 1 END) as quote_count,
        COUNT(CASE WHEN o.status = 'cancelado' THEN 1 END) as canceled_count,
        COALESCE(SUM(CASE WHEN o.status = 'concluido' THEN o.total_price ELSE 0 END), 0) as total_revenue,
        COALESCE(AVG(CASE WHEN o.status = 'concluido' THEN o.total_price END), 0) as avg_ticket
      FROM orders o
      WHERE (o.completed_at IS NOT NULL AND to_char(o.completed_at, 'YYYY-MM') = $1)
         OR (o.completed_at IS NULL AND to_char(o.created_at, 'YYYY-MM') = $1)
    `, [currentMonth]);

    // Agregação de Despesas
    const expAggRes = await pgClient.query(`
      SELECT COALESCE(SUM(amount), 0) as total_expenses
      FROM transactions
      WHERE type = 'despesa' AND status = 'confirmado' AND to_char(date, 'YYYY-MM') = $1
    `, [currentMonth]);

    // Produtividade por Técnico
    const techProdRes = await pgClient.query(`
      SELECT 
        p.id,
        p.name as tech_name,
        COUNT(CASE WHEN o.status = 'concluido' THEN 1 END) as completed_orders,
        COUNT(CASE WHEN o.status = 'em_andamento' THEN 1 END) as in_progress_orders,
        COALESCE(SUM(CASE WHEN o.status = 'concluido' THEN o.total_price ELSE 0 END), 0) as generated_revenue
      FROM profiles p
      LEFT JOIN orders o ON o.tech_id = p.id
      WHERE p.active = true
      GROUP BY p.id, p.name
      ORDER BY generated_revenue DESC
    `);
    const t1DashAgg = performance.now();

    results.test3_dashboardQueries = {
      ordersFetchTimeMs: (t1DashOrders - t0DashOrders).toFixed(2),
      transactionsFetchTimeMs: (t1DashTx - t0DashTx).toFixed(2),
      fullAggregationTimeMs: (t1DashAgg - t0DashAgg).toFixed(2),
      totalOrdersLoaded: dashOrdersRes.rows.length,
      totalTransactionsLoaded: dashTxRes.rows.length,
      currentMonthAggregates: {
        month: currentMonth,
        revenue: Number(dashAggRes.rows[0].total_revenue).toFixed(2),
        expenses: Number(expAggRes.rows[0].total_expenses).toFixed(2),
        completedCount: dashAggRes.rows[0].completed_count,
        avgTicket: Number(dashAggRes.rows[0].avg_ticket).toFixed(2)
      },
      technicianProductivity: techProdRes.rows
    };
    console.log(`  ✔ Dashboard Carregamento: Ordens=${results.test3_dashboardQueries.ordersFetchTimeMs}ms (${dashOrdersRes.rows.length} itens) | Transações=${results.test3_dashboardQueries.transactionsFetchTimeMs}ms (${dashTxRes.rows.length} itens) | Agregações=${results.test3_dashboardQueries.fullAggregationTimeMs}ms`);

    // =========================================================================
    // TESTE 4: Filtros e Busca de Ordens de Serviço
    // =========================================================================
    console.log('\n▶ [TESTE 4] Testando Filtros e Buscas de Ordens de Serviço...');
    const searchQueries = [
      { type: 'Status', query: "o.status = 'concluido'", name: 'Filtro Status = concluido' },
      { type: 'Status', query: "o.status = 'orcamento'", name: 'Filtro Status = orcamento' },
      { type: 'Text Search', query: "c.name ILIKE '%Silveira%'", name: 'Busca Cliente por nome (Silveira)' },
      { type: 'Text Search', query: "o.description ILIKE '%chuveiro%'", name: 'Busca Descrição (chuveiro)' },
      { type: 'Text Search', query: "o.address ILIKE '%Copacabana%'", name: 'Busca Endereço (Copacabana)' },
      { type: 'Combined', query: "o.status = 'concluido' AND o.total_price >= 500", name: 'Status concluido e Valor >= R$ 500' }
    ];

    const searchResults = [];
    for (const sq of searchQueries) {
      const t0 = performance.now();
      const sRes = await pgClient.query(`
        SELECT o.id, o.code, o.status, o.total_price, c.name as client_name, o.description
        FROM orders o
        LEFT JOIN clients c ON o.client_id = c.id
        WHERE ${sq.query}
        ORDER BY o.created_at DESC
      `);
      const t1 = performance.now();
      searchResults.push({
        test: sq.name,
        type: sq.type,
        matches: sRes.rows.length,
        executionTimeMs: (t1 - t0).toFixed(2)
      });
    }

    results.test4_searchAndFilter = searchResults;
    console.log(`  ✔ 6 Consultas de Busca e Filtros executadas com sucesso.`);
    for (const sr of searchResults) {
      console.log(`    - ${sr.test}: ${sr.matches} resultados em ${sr.executionTimeMs}ms`);
    }

    // =========================================================================
    // TESTE 5: Exportação de Relatório CSV com Volume Real e Sanitização
    // =========================================================================
    console.log('\n▶ [TESTE 5] Testando Geração e Sanitização de Relatório CSV...');
    
    // Obter todas as ordens com dados de clientes e técnicos
    const t0CsvQuery = performance.now();
    const allOrdersForCsv = await pgClient.query(`
      SELECT o.code, o.status, c.name as client_name, c.phone as client_phone,
             o.address, p.name as tech_name, o.total_price, o.payment_method,
             o.warranty_days, o.scheduled_at, o.completed_at, o.created_at,
             o.description
      FROM orders o
      LEFT JOIN clients c ON o.client_id = c.id
      LEFT JOIN profiles p ON o.tech_id = p.id
      ORDER BY o.code ASC
    `);
    const t1CsvQuery = performance.now();

    const t0CsvGen = performance.now();
    const headers = [
      'Código OS', 'Status', 'Cliente', 'Telefone', 'Endereço',
      'Técnico', 'Valor Total (R$)', 'Forma Pagamento', 'Garantia (Dias)',
      'Data Agendamento', 'Data Conclusão', 'Data Criação', 'Observações'
    ];

    // Incluir teste de fórmula maliciosa para assegurar mitigação contra CSV injection
    const testCases = [
      ...allOrdersForCsv.rows,
      {
        code: 99999,
        status: 'orcamento',
        client_name: '=cmd|’ /C calc’!A0', // Injeção de fórmula
        client_phone: '+5511999999999',     // Inicia com +
        address: '-2+5+cmd',                // Inicia com -
        tech_name: '@SUM(1+1)',             // Inicia com @
        total_price: 150.00,
        payment_method: 'PIX',
        warranty_days: 90,
        scheduled_at: null,
        completed_at: null,
        created_at: new Date().toISOString(),
        description: 'Texto com "aspas duplas" e\nquebra de linha multiline'
      }
    ];

    const rows = testCases.map(o => [
      sanitizeCsvCell(`#${o.code}`),
      sanitizeCsvCell(o.status),
      sanitizeCsvCell(o.client_name || ''),
      sanitizeCsvCell(o.client_phone || ''),
      sanitizeCsvCell(o.address || ''),
      sanitizeCsvCell(o.tech_name || ''),
      sanitizeCsvCell(Number(o.total_price || 0).toFixed(2)),
      sanitizeCsvCell(o.payment_method || ''),
      sanitizeCsvCell(o.warranty_days || 90),
      sanitizeCsvCell(o.scheduled_at || ''),
      sanitizeCsvCell(o.completed_at || ''),
      sanitizeCsvCell(o.created_at),
      sanitizeCsvCell(o.description || '')
    ]);

    const csvContent = '\uFEFF' + [headers.map(h => sanitizeCsvCell(h)).join(';'), ...rows.map(r => r.join(';'))].join('\r\n');
    const t1CsvGen = performance.now();

    // Validações de integridade do CSV
    const csvLines = csvContent.split('\r\n');
    const formulaInjectedEscaped = csvContent.includes(`"'=cmd|’ /C calc’!A0"`);
    const plusEscaped = csvContent.includes(`"'+5511999999999"`);
    const minusEscaped = csvContent.includes(`"'-2+5+cmd"`);
    const atEscaped = csvContent.includes(`"'@SUM(1+1)"`);
    const quotesEscaped = csvContent.includes(`"Texto com ""aspas duplas"" e\nquebra de linha multiline"`);

    results.test5_csvExport = {
      dbQueryTimeMs: (t1CsvQuery - t0CsvQuery).toFixed(2),
      csvGenerationTimeMs: (t1CsvGen - t0CsvGen).toFixed(2),
      totalRowsExported: rows.length,
      csvSizeBytes: Buffer.byteLength(csvContent, 'utf8'),
      csvLinesCount: csvLines.length,
      securityFormulaShield: formulaInjectedEscaped && plusEscaped && minusEscaped && atEscaped,
      quotesAndNewlinePreserved: quotesEscaped
    };

    console.log(`  ✔ Exportação CSV: DB Query=${results.test5_csvExport.dbQueryTimeMs}ms | Geração CSV=${results.test5_csvExport.csvGenerationTimeMs}ms (${rows.length} linhas, ${results.test5_csvExport.csvSizeBytes} bytes)`);
    console.log(`  ✔ Proteção contra CSV Injection verificada (=, +, -, @ prefixados com apóstrofo seguro): ${results.test5_csvExport.securityFormulaShield}`);

    // =========================================================================
    // AUDITORIA EXPLAIN ANALYZE DAS QUERIES PRINCIPAIS
    // =========================================================================
    console.log('\n▶ [AUDITORIA] Executando EXPLAIN ANALYZE nas queries principais...');
    
    // 1. Explain View v_inventory_stock
    const expView = await pgClient.query('EXPLAIN (ANALYZE, COSTS, BUFFERS) SELECT * FROM public.v_inventory_stock');
    results.explainPlans.view_inventory_stock = expView.rows.map(r => r['QUERY PLAN']);

    // 2. Explain Orders com JOINs
    const expOrders = await pgClient.query(`
      EXPLAIN (ANALYZE, COSTS, BUFFERS)
      SELECT o.*, c.name, p.name 
      FROM orders o 
      LEFT JOIN clients c ON o.client_id = c.id 
      LEFT JOIN profiles p ON o.tech_id = p.id
      ORDER BY o.created_at DESC
    `);
    results.explainPlans.orders_with_joins = expOrders.rows.map(r => r['QUERY PLAN']);

    // 3. Explain Dashboard Aggregation
    const expDashboard = await pgClient.query(`
      EXPLAIN (ANALYZE, COSTS, BUFFERS)
      SELECT status, count(*), sum(total_price) 
      FROM orders 
      WHERE created_at >= now() - interval '30 days' 
      GROUP BY status
    `);
    results.explainPlans.dashboard_aggregation = expDashboard.rows.map(r => r['QUERY PLAN']);

    console.log('  ✔ EXPLAIN ANALYZE concluído para as 3 consultas core.');

    return results;
  } catch (err) {
    console.error('❌ Erro na bateria de testes de carga:', err);
    throw err;
  } finally {
    await pgClient.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('run-load-test-battery.mjs')) {
  runLoadTestBattery()
    .then((results) => {
      console.log('\n===============================================================');
      console.log('📊 RESULTADOS FINAIS DA BATERIA DE TESTES DE CARGA:');
      console.log('===============================================================\n');
      console.log(JSON.stringify(results, null, 2));
      process.exit(0);
    })
    .catch((err) => {
      console.error('Falha na execução da bateria:', err);
      process.exit(1);
    });
}
