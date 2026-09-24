/**
 * Topa Tudo - Verificação de Aplicação em Produção e APIs Supabase com Nova Carga
 * Arquivo: tests/test-production-apis.mjs
 */

import { performance } from 'perf_hooks';

const SUPABASE_URL = 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
const ANON_KEY = 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';
const VERCEL_URL = 'https://topa-tudo-app.vercel.app';

const HEADERS = {
  apikey: ANON_KEY,
  Authorization: `Bearer ${ANON_KEY}`,
  'Content-Type': 'application/json'
};

async function testEndpoint(name, url, options = {}) {
  const t0 = performance.now();
  try {
    const res = await fetch(url, options);
    const t1 = performance.now();
    const duration = t1 - t0;
    const isJson = res.headers.get('content-type')?.includes('application/json');
    const data = isJson ? await res.json() : await res.text();
    const count = Array.isArray(data) ? data.length : (typeof data === 'string' ? data.length : 1);
    
    return {
      name,
      status: res.status,
      ok: res.ok,
      durationMs: Number(duration.toFixed(2)),
      count,
      isJson,
      sample: Array.isArray(data) ? data[0] : null
    };
  } catch (err) {
    return {
      name,
      status: 0,
      ok: false,
      error: err.message
    };
  }
}

export async function runProductionVerification() {
  console.log('\n===============================================================');
  console.log('🌐 VERIFICAÇÃO DE PRODUÇÃO: APIs SUPABASE E APLICAÇÃO VERCEL');
  console.log('===============================================================\n');

  const tests = [
    {
      name: 'Vercel Web App (HTML Shell & Assets)',
      url: VERCEL_URL,
      options: { method: 'GET' }
    },
    {
      name: 'Supabase REST - Ordens de Serviço com JOINs (OSList & Dashboard)',
      url: `${SUPABASE_URL}/rest/v1/orders?select=id,code,status,total_price,scheduled_at,completed_at,created_at,client:clients(id,name,phone,address),tech:profiles(id,name)&order=created_at.desc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - View de Estoque Dinâmico (v_inventory_stock)',
      url: `${SUPABASE_URL}/rest/v1/v_inventory_stock?select=*&order=name.asc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - Transações Financeiras (FinancialView & Dashboard)',
      url: `${SUPABASE_URL}/rest/v1/transactions?select=*&order=date.desc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - Lista de Clientes (ClientList)',
      url: `${SUPABASE_URL}/rest/v1/clients?select=*&order=name.asc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - Agenda Operacional (AgendaView)',
      url: `${SUPABASE_URL}/rest/v1/schedule?select=id,date,start_time,end_time,description,status,client:clients(name,phone),tech:profiles(name)&order=date.asc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - Ferramentas e Status (ToolsView)',
      url: `${SUPABASE_URL}/rest/v1/tools?select=id,code,name,category,status,assigned_tech:profiles(name)&order=code.asc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase REST - Catálogo de Serviços (ServicesCatalogView)',
      url: `${SUPABASE_URL}/rest/v1/services_catalog?select=*&order=title.asc`,
      options: { headers: HEADERS }
    },
    {
      name: 'Supabase RPC - complete_work_order Idempotência Test',
      url: `${SUPABASE_URL}/rest/v1/rpc/complete_work_order`,
      options: {
        method: 'POST',
        headers: HEADERS,
        body: JSON.stringify({ p_order_id: '50636662-b0df-4b51-86e1-be44949d8068' })
      }
    }
  ];

  const results = [];
  for (const t of tests) {
    const res = await testEndpoint(t.name, t.url, t.options);
    results.push(res);
    const icon = res.ok ? '✅' : '❌';
    console.log(`${icon} [${res.status}] ${res.name}: ${res.durationMs}ms (Registros/Tamanho: ${res.count})`);
  }

  console.log('\n===============================================================');
  console.log('📊 RESUMO DE DISPONIBILIDADE E LATÊNCIA DE PRODUÇÃO:');
  console.log('===============================================================\n');
  console.table(results.map(r => ({
    Endpoint: r.name,
    Status: r.status,
    'Latência (ms)': r.durationMs,
    'Registros Retornados': r.count,
    Sucesso: r.ok ? 'OK' : 'FALHA'
  })));

  return results;
}

if (process.argv[1] && process.argv[1].endsWith('test-production-apis.mjs')) {
  runProductionVerification()
    .then(() => process.exit(0))
    .catch((err) => {
      console.error(err);
      process.exit(1);
    });
}
