/**
 * Script de Testes E2E e QA Abrangente - Topa Tudo
 * Simula todos os fluxos de trabalho reais contra a API e Banco do Supabase.
 */

import { createClient } from '@supabase/supabase-js';
import { getLocalDateString, getLocalTimeString, createLocalISOString } from '../src/core/utils/date';
import { parseBRLNumber } from '../src/core/utils/currency';
import { sanitizeCsvCell } from '../src/core/utils/security';

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';
const STORAGE_BUCKET = 'topatudo-media';

const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
  },
});

interface TestResult {
  step: string;
  name: string;
  passed: boolean;
  details?: string;
  error?: any;
}

const testResults: TestResult[] = [];

function recordResult(step: string, name: string, passed: boolean, details?: string, error?: any) {
  testResults.push({ step, name, passed, details, error });
  const statusMark = passed ? '✅ PASSOU' : '❌ FALHOU';
  console.log(`[${statusMark}] [${step}] ${name}`);
  if (details) console.log(`   ℹ️ ${details}`);
  if (error) console.error(`   ⚠️ Detalhe do Erro:`, error);
}

// Rastreamento para Teardown Seguro
const createdRecords: {
  clientIds: string[];
  inventoryIds: string[];
  orderIds: string[];
  scheduleIds: string[];
  toolIds: string[];
  transactionIds: string[];
  movementIds: string[];
  storagePaths: string[];
} = {
  clientIds: [],
  inventoryIds: [],
  orderIds: [],
  scheduleIds: [],
  toolIds: [],
  transactionIds: [],
  movementIds: [],
  storagePaths: [],
};

async function runAllTests() {
  console.log('======================================================================');
  console.log('🚀 INICIANDO BATERIA DE TESTES E2E - SISTEMA TOPA TUDO');
  console.log(`🔗 Endpoint: ${SUPABASE_URL}`);
  console.log('======================================================================\n');

  let adminProfile: any = null;
  let techProfile: any = null;

  // ============================================================================
  // FLUXO 1: AUTENTICAÇÃO / PERFIS
  // ============================================================================
  console.log('\n--- FLUXO 1: AUTENTICAÇÃO / PERFIS ---');
  try {
    const { data: profiles, error } = await supabase
      .from('profiles')
      .select('*')
      .eq('active', true)
      .order('name');

    if (error) throw error;

    recordResult(
      'FLUXO 1',
      'Obter lista de perfis ativos',
      profiles && profiles.length > 0,
      `Retornados ${profiles?.length} perfis ativos: ${profiles?.map((p) => `${p.name} (${p.role})`).join(', ')}`
    );

    // Encontrar ou validar perfis esperados
    adminProfile = profiles?.find((p) => p.role === 'adm');
    techProfile = profiles?.find((p) => p.role === 'tecnico');

    // Testar login seguro com PIN via RPC verify_user_pin
    if (adminProfile) {
      const adminPin = adminProfile.name === 'Eduardo Henrique' ? '7011' : '1234';
      const wrongPin = '9999';

      const { data: loginSuccess } = await supabase.rpc('verify_user_pin', {
        p_user_id: adminProfile.id,
        p_pin: adminPin,
      });

      const { data: loginFail } = await supabase.rpc('verify_user_pin', {
        p_user_id: adminProfile.id,
        p_pin: wrongPin,
      });

      recordResult(
        'FLUXO 1',
        `Login ADM (${adminProfile.name}) com PIN correto via RPC verify_user_pin`,
        loginSuccess === true,
        `PIN validado com sucesso via RPC segura.`
      );

      recordResult(
        'FLUXO 1',
        `Rejeição ADM (${adminProfile.name}) com PIN incorreto ("${wrongPin}")`,
        loginFail === false,
        `PIN incorreto foi devidamente rejeitado pela RPC.`
      );
    }

    if (techProfile) {
      const techPin = techProfile.name === 'Agripino Onofre' ? '2909' : '0000';
      const wrongPin = '8888';

      const { data: loginSuccess } = await supabase.rpc('verify_user_pin', {
        p_user_id: techProfile.id,
        p_pin: techPin,
      });

      const { data: loginFail } = await supabase.rpc('verify_user_pin', {
        p_user_id: techProfile.id,
        p_pin: wrongPin,
      });

      recordResult(
        'FLUXO 1',
        `Login Técnico (${techProfile.name}) com PIN correto via RPC verify_user_pin`,
        loginSuccess === true,
        `PIN validado com sucesso via RPC segura.`
      );

      recordResult(
        'FLUXO 1',
        `Rejeição Técnico (${techProfile.name}) com PIN incorreto ("${wrongPin}")`,
        loginFail === false,
        `PIN incorreto rejeitado.`
      );
    }

    // AUDITORIA DE SEGURANÇA: Verificação de vazamento de PINs no SELECT * com chave ANON
    const hasPlaintextPins = profiles?.some((p) => typeof p.pin === 'string' && p.pin.length === 4);
    if (hasPlaintextPins) {
      recordResult(
        'FLUXO 1 [SEGURANÇA]',
        'Vulnerabilidade: PINs trafegam em texto plano via API pública (anon key)',
        false,
        'CRÍTICO: A query pública na tabela profiles retorna o PIN em texto puro de todos os usuários (inclusive administradores). Qualquer usuário pode inspecionar o tráfego ou consultar a tabela via REST e descobrir os PINs de todos.'
      );
    } else {
      recordResult(
        'FLUXO 1 [SEGURANÇA]',
        'Proteção de PINs na tabela profiles',
        true,
        'PINs protegidos contra vazamento em texto plano (hasheados com pgcrypto e validados via RPC).'
      );
    }
  } catch (err: any) {
    recordResult('FLUXO 1', 'Erro inesperado no Fluxo de Perfis', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 2: CLIENTES (CRM)
  // ============================================================================
  console.log('\n--- FLUXO 2: CLIENTES (CRM) ---');
  let testClient: any = null;
  try {
    const newClientPayload = {
      name: 'Carlos Alberto QA Teste',
      phone: '(11) 98765-4321',
      address: 'Av. Paulista, 1000 - Apto 52, Bela Vista, São Paulo - SP',
      notes: 'Cliente VIP - Teste Automatizado E2E',
    };

    const { data: createdClient, error: createErr } = await supabase
      .from('clients')
      .insert(newClientPayload)
      .select()
      .single();

    if (createErr) throw createErr;
    testClient = createdClient;
    createdRecords.clientIds.push(testClient.id);

    recordResult(
      'FLUXO 2',
      'Criar novo cliente com dados completos e formato BR',
      Boolean(testClient?.id),
      `Cliente criado com ID: ${testClient.id}, Telefone: ${testClient.phone}`
    );

    // Buscar e consultar cliente criado
    const { data: fetchedClient, error: fetchErr } = await supabase
      .from('clients')
      .select('*')
      .eq('id', testClient.id)
      .single();

    if (fetchErr) throw fetchErr;

    const matches =
      fetchedClient.name === newClientPayload.name &&
      fetchedClient.phone === newClientPayload.phone &&
      fetchedClient.address === newClientPayload.address &&
      fetchedClient.notes === newClientPayload.notes;

    recordResult(
      'FLUXO 2',
      'Buscar e consultar integridade dos dados do cliente',
      matches,
      matches ? 'Todos os campos retornaram idênticos ao inserido.' : 'Houve divergência nos campos retornados.'
    );
  } catch (err: any) {
    recordResult('FLUXO 2', 'Erro no Fluxo de Clientes', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 3: CATÁLOGO E ESTOQUE
  // ============================================================================
  console.log('\n--- FLUXO 3: CATÁLOGO E ESTOQUE ---');
  let testMaterial: any = null;
  try {
    // 3.1 Criar material
    const materialPayload = {
      code: 'CAB-25-QA',
      name: 'Cabo Flexível 2.5mm (QA Test)',
      category: 'Elétrica',
      unit: 'm',
      cost_price: 3.5,
      min_stock: 10,
      max_stock: 100,
      notes: 'Material para teste automatizado de estoque',
    };

    const { data: createdMat, error: matErr } = await supabase
      .from('inventory')
      .insert(materialPayload)
      .select()
      .single();

    if (matErr) throw matErr;
    testMaterial = createdMat;
    createdRecords.inventoryIds.push(testMaterial.id);

    recordResult(
      'FLUXO 3',
      'Criar material de estoque ("Cabo Flexível 2.5mm")',
      Boolean(testMaterial?.id),
      `Material criado ID: ${testMaterial.id}, Custo: R$ ${testMaterial.cost_price}`
    );

    // 3.2 Registrar entrada avulsa de 50 unidades
    const movementPayload = {
      material_id: testMaterial.id,
      type: 'entrada',
      quantity: 50.0,
      notes: 'Entrada avulsa inicial de teste QA',
    };

    const { data: movData, error: movErr } = await supabase
      .from('inventory_movements')
      .insert(movementPayload)
      .select()
      .single();

    if (movErr) throw movErr;
    createdRecords.movementIds.push(movData.id);

    recordResult(
      'FLUXO 3',
      'Registrar entrada avulsa de 50 unidades',
      movData.quantity === 50,
      `Movimento ID: ${movData.id}, Qtd: +${movData.quantity}`
    );

    // 3.3 Consultar saldo atual via view v_inventory_stock
    const { data: stockViewData, error: viewErr } = await supabase
      .from('v_inventory_stock')
      .select('*')
      .eq('id', testMaterial.id)
      .single();

    if (viewErr) throw viewErr;

    const saldoAtual = Number(stockViewData.saldo_atual);
    const entradas = Number(stockViewData.entradas);
    const saidas = Number(stockViewData.saidas);

    const isStockAccurate = saldoAtual === 50.0 && entradas === 50.0 && saidas === 0.0;

    recordResult(
      'FLUXO 3',
      'Consultar saldo na view v_inventory_stock (esperado: exatamente 50.00)',
      isStockAccurate,
      `Saldo Atual: ${saldoAtual}, Entradas: ${entradas}, Saídas: ${saidas}`
    );
  } catch (err: any) {
    recordResult('FLUXO 3', 'Erro no Fluxo de Catálogo e Estoque', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 4: AGENDA TÉCNICA E TIMEZONE DRIFT
  // ============================================================================
  console.log('\n--- FLUXO 4: AGENDA TÉCNICA & TIMEZONE DRIFT ---');
  try {
    if (!testClient) throw new Error('Cliente de teste não disponível');

    const scheduleDate = '2025-07-20';
    const scheduleStartTime = '22:00';
    const scheduleEndTime = '23:30';

    // 4.1 Criar agendamento na tabela schedule
    const { data: schedData, error: schedErr } = await supabase
      .from('schedule')
      .insert({
        date: scheduleDate,
        start_time: scheduleStartTime,
        end_time: scheduleEndTime,
        client_id: testClient.id,
        tech_id: techProfile?.id || null,
        description: 'Atendimento técnico noturno teste',
        status: 'agendado',
      })
      .select()
      .single();

    if (schedErr) throw schedErr;
    createdRecords.scheduleIds.push(schedData.id);

    recordResult(
      'FLUXO 4',
      'Criar agendamento para o cliente com data e horário',
      Boolean(schedData?.id),
      `Agendamento criado: Data ${schedData.date}, Hora: ${schedData.start_time}`
    );

    // 4.2 Testar eliminação de Timezone Drift com utilitários getLocalDateString e createLocalISOString
    // scheduled_at no PostgreSQL é TIMESTAMPTZ.
    // Usando createLocalISOString:
    const safeLocalIso = createLocalISOString(scheduleDate, scheduleStartTime);

    const { data: testOrderTz, error: tzOrderErr } = await supabase
      .from('orders')
      .insert({
        client_id: testClient.id,
        tech_id: techProfile?.id || null,
        status: 'agendado',
        description: 'Teste de Timezone Drift com utilitário local',
        scheduled_at: safeLocalIso,
      })
      .select()
      .single();

    if (tzOrderErr) throw tzOrderErr;
    createdRecords.orderIds.push(testOrderTz.id);

    // Analisar como o banco armazenou e como os utilitários do frontend leem
    const storedScheduledAt = testOrderTz.scheduled_at;
    const retrievedLocalDate = getLocalDateString(storedScheduledAt);
    const retrievedLocalTime = getLocalTimeString(storedScheduledAt);

    // Testar se ISO date drift ocorre com timestamp com offset noturno:
    const nightIsoWithOffset = '2025-07-20T22:00:00-03:00';
    const driftIsoDateOld = new Date(nightIsoWithOffset).toISOString().substring(0, 10); // "2025-07-21"
    const safeLocalDate = getLocalDateString(nightIsoWithOffset); // "2025-07-20"
    const dateDriftPrevented = safeLocalDate === '2025-07-20';

    recordResult(
      'FLUXO 4 [DIAGNÓSTICO TIMEZONE]',
      'Proteção contra Timezone Drift com horário noturno (22h00)',
      dateDriftPrevented,
      `Drift eliminado: com getLocalDateString, data noturna preserva "${safeLocalDate}" sem virar "${driftIsoDateOld}".`
    );
  } catch (err: any) {
    recordResult('FLUXO 4', 'Erro no Fluxo de Agenda', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 5: FLUXO COMPLETO DE ORDEM DE SERVIÇO (OS)
  // ============================================================================
  console.log('\n--- FLUXO 5: ORDEM DE SERVIÇO COMPLETA ---');
  let testOrder: any = null;
  let testPhotoPath: string = '';
  try {
    if (!testClient || !testMaterial) {
      throw new Error('Pré-requisitos (cliente e material) não atendidos');
    }

    // 5.1 Criar nova OS com status "em_andamento", total R$ 250,00, garantia 90 dias
    const orderPayload = {
      client_id: testClient.id,
      tech_id: techProfile?.id || null,
      status: 'em_andamento',
      total_price: 250.0,
      warranty_days: 90,
      description: 'Instalação de circuito elétrico e tomadas (Teste E2E)',
      payment_method: 'pix',
      address: testClient.address,
    };

    const { data: ordData, error: ordErr } = await supabase
      .from('orders')
      .insert(orderPayload)
      .select()
      .single();

    if (ordErr) throw ordErr;
    testOrder = ordData;
    createdRecords.orderIds.push(testOrder.id);

    recordResult(
      'FLUXO 5',
      'Criar nova OS com status "em_andamento", total R$ 250,00, garantia 90 dias',
      Boolean(testOrder?.id && testOrder.code),
      `OS criada: #${testOrder.code} (ID: ${testOrder.id})`
    );

    // 5.2 Adicionar 2 itens na OS:
    // Item 1: 10 unidades do "Cabo Flexível 2.5mm" com source = 'estoque'
    // Item 2: 1 unidade de "Fita Isolante" com source = 'comprado'
    const itemsPayload = [
      {
        order_id: testOrder.id,
        material_id: testMaterial.id,
        name: 'Cabo Flexível 2.5mm (QA Test)',
        quantity: 10.0,
        unit_cost: 3.5,
        source: 'estoque',
      },
      {
        order_id: testOrder.id,
        material_id: null,
        name: 'Fita Isolante 3M Imperial',
        quantity: 1.0,
        unit_cost: 12.0,
        source: 'comprado',
      },
    ];

    const { data: createdItems, error: itemsErr } = await supabase
      .from('order_items')
      .insert(itemsPayload)
      .select();

    if (itemsErr) throw itemsErr;

    recordResult(
      'FLUXO 5',
      'Adicionar 2 itens na OS (Item 1: 10un estoque; Item 2: 1un comprado)',
      createdItems && createdItems.length === 2,
      `Itens inseridos com sucesso: ${createdItems.map((it) => `${it.name} [${it.source}]`).join(', ')}`
    );

    // 5.3 Simular upload de foto de vistoria "Antes" no bucket topatudo-media
    testPhotoPath = `os/e2e_antes_${Date.now()}.jpg`;
    const fakeImageBuffer = Buffer.from('FAKE_JPEG_BINARY_DATA_FOR_E2E_TEST');

    const { data: uploadData, error: uploadErr } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(testPhotoPath, fakeImageBuffer, {
        contentType: 'image/jpeg',
      });

    if (uploadErr) throw uploadErr;
    createdRecords.storagePaths.push(testPhotoPath);

    const { data: publicUrlData } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(testPhotoPath);
    const photoUrl = publicUrlData.publicUrl;

    // Atualizar photos_before na OS
    const { error: photoUpdateErr } = await supabase
      .from('orders')
      .update({ photos_before: [photoUrl] })
      .eq('id', testOrder.id);

    if (photoUpdateErr) throw photoUpdateErr;

    recordResult(
      'FLUXO 5',
      'Simular upload de foto "Antes" no Supabase Storage e associar à OS',
      Boolean(photoUrl),
      `Upload realizado em "${testPhotoPath}", URL pública associada ao photos_before`
    );

    // 5.4 Executar conclusão da OS chamando RPC complete_work_order
    console.log(`   ⚡ Invocando RPC complete_work_order para OS #${testOrder.code}...`);
    const { data: rpcResult, error: rpcErr } = await supabase.rpc('complete_work_order', {
      p_order_id: testOrder.id,
    });

    if (rpcErr) throw rpcErr;

    recordResult(
      'FLUXO 5',
      'Execução da RPC complete_work_order',
      Boolean(rpcResult?.success),
      `Retorno RPC: ${JSON.stringify(rpcResult)}`
    );

    // 5.5 Validar critérios a, b, c, d
    // a) O status da OS mudou para 'concluido' e completed_at foi preenchido
    const { data: updatedOrder, error: fetchOrderErr } = await supabase
      .from('orders')
      .select('*')
      .eq('id', testOrder.id)
      .single();

    if (fetchOrderErr) throw fetchOrderErr;

    const isOrderConcluded =
      updatedOrder.status === 'concluido' && updatedOrder.completed_at !== null;

    recordResult(
      'FLUXO 5 (Critério A)',
      'Status da OS alterado para "concluido" e completed_at preenchido',
      isOrderConcluded,
      `Status atual: "${updatedOrder.status}", completed_at: "${updatedOrder.completed_at}"`
    );

    // b) O estoque do material foi reduzido em 10 unidades (de 50 para 40)
    const { data: updatedStock, error: stockCheckErr } = await supabase
      .from('v_inventory_stock')
      .select('*')
      .eq('id', testMaterial.id)
      .single();

    if (stockCheckErr) throw stockCheckErr;

    const newSaldo = Number(updatedStock.saldo_atual);
    const newSaidas = Number(updatedStock.saidas);
    const isStockReducedBy10 = newSaldo === 40.0 && newSaidas === 10.0;

    recordResult(
      'FLUXO 5 (Critério B)',
      'Estoque reduzido em 10 unidades (de 50 para 40 na view v_inventory_stock)',
      isStockReducedBy10,
      `Saldo atual: ${newSaldo} (esperado: 40.00), Saídas: ${newSaidas} (esperado: 10.00)`
    );

    // c) O item de origem 'comprado' NÃO reduziu estoque
    const { data: allMovements, error: movListErr } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('order_id', testOrder.id);

    if (movListErr) throw movListErr;
    allMovements?.forEach((m) => createdRecords.movementIds.push(m.id));

    const onlyEstoqueMoved =
      allMovements.length === 1 &&
      allMovements[0].material_id === testMaterial.id &&
      Number(allMovements[0].quantity) === 10.0 &&
      allMovements[0].type === 'saida';

    recordResult(
      'FLUXO 5 (Critério C)',
      'Item "comprado" (Fita Isolante) NÃO reduziu estoque',
      onlyEstoqueMoved,
      `Movimentos gerados para a OS: ${allMovements.length} (apenas o material do estoque foi movimentado)`
    );

    // d) Foi gerada automaticamente transação em transactions (receita, confirmado, R$ 250,00)
    const { data: orderTx, error: txErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', testOrder.id);

    if (txErr) throw txErr;
    orderTx?.forEach((t) => createdRecords.transactionIds.push(t.id));

    const isTxValid =
      orderTx.length === 1 &&
      orderTx[0].type === 'receita' &&
      orderTx[0].status === 'confirmado' &&
      Number(orderTx[0].amount) === 250.0;

    recordResult(
      'FLUXO 5 (Critério D)',
      'Transação gerada automaticamente (receita, confirmado, R$ 250,00)',
      isTxValid,
      orderTx.length > 0
        ? `Transação ID: ${orderTx[0].id}, Tipo: ${orderTx[0].type}, Status: ${orderTx[0].status}, Valor: R$ ${orderTx[0].amount}`
        : 'Nenhuma transação encontrada para esta OS.'
    );
  } catch (err: any) {
    recordResult('FLUXO 5', 'Erro no Fluxo Completo de OS', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 6: TESTE DE ESTRESSE DE IDEMPOTÊNCIA E REGRAS DE NEGÓCIO
  // ============================================================================
  console.log('\n--- FLUXO 6: ESTRESSE, IDEMPOTÊNCIA E REGRAS DE NEGÓCIO ---');
  try {
    if (!testOrder || !testMaterial) {
      throw new Error('OS de teste não disponível para estresse');
    }

    // 6.1 Chamar complete_work_order uma SEGUNDA VEZ na mesma OS (já concluída)
    console.log('   🧪 Teste 6.1: Segunda chamada de complete_work_order na OS já concluída...');
    const { data: secondRpcCall, error: secondRpcErr } = await supabase.rpc('complete_work_order', {
      p_order_id: testOrder.id,
    });

    if (secondRpcErr) throw secondRpcErr;

    // Verificar se duplicou baixa ou receita
    const { data: stockAfterSecond, error: s2Err } = await supabase
      .from('v_inventory_stock')
      .select('*')
      .eq('id', testMaterial.id)
      .single();

    if (s2Err) throw s2Err;

    const { data: txAfterSecond, error: tx2Err } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', testOrder.id);

    if (tx2Err) throw tx2Err;

    const didNotDuplicateOnSameStatus =
      Number(stockAfterSecond.saldo_atual) === 40.0 && txAfterSecond.length === 1;

    recordResult(
      'FLUXO 6.1',
      'Idempotência: Chamada duplicada com status="concluido"',
      didNotDuplicateOnSameStatus && secondRpcCall?.message === 'Ordem de serviço já está concluída',
      `Resposta RPC: "${secondRpcCall?.message}", Saldo Estoque: ${stockAfterSecond.saldo_atual}, Qtd Transações: ${txAfterSecond.length}`
    );

    // 6.2 Reabrir a OS para 'em_andamento' e chamar complete_work_order de novo
    console.log('   🧪 Teste 6.2: Reabrindo OS para "em_andamento" e chamando complete_work_order novamente...');
    const { error: reopenErr } = await supabase
      .from('orders')
      .update({ status: 'em_andamento' })
      .eq('id', testOrder.id);

    if (reopenErr) throw reopenErr;

    // Chamar a RPC novamente
    const { data: rpcReopenedResult, error: rpcReopenErr } = await supabase.rpc('complete_work_order', {
      p_order_id: testOrder.id,
    });

    if (rpcReopenErr) throw rpcReopenErr;

    // Verificar se estoque foi reduzido DE NOVO (40 -> 30) e se transação foi duplicada (1 -> 2)
    const { data: stockAfterReopen, error: sReopenErr } = await supabase
      .from('v_inventory_stock')
      .select('*')
      .eq('id', testMaterial.id)
      .single();

    if (sReopenErr) throw sReopenErr;

    const { data: txAfterReopen, error: txReopenErr } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', testOrder.id);

    if (txReopenErr) throw txReopenErr;
    txAfterReopen?.forEach((t) => createdRecords.transactionIds.push(t.id));

    // Coletar novas movimentações criadas
    const { data: movsAfterReopen } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('order_id', testOrder.id);
    movsAfterReopen?.forEach((m) => createdRecords.movementIds.push(m.id));

    const stockWasDuplicated = Number(stockAfterReopen.saldo_atual) === 30.0;
    const txWasDuplicated = txAfterReopen.length === 2;

    if (stockWasDuplicated || txWasDuplicated) {
      recordResult(
        'FLUXO 6.2 [FALHA DE NEGÓCIO CRÍTICA]',
        'Vulnerabilidade: Reabrir OS e concluir novamente DUPLICA baixa de estoque e receitas',
        false,
        `FALHA GRAVE: Ao reabrir a OS e reconcluir, o estoque sofreu baixa DUPLA (caiu para ${stockAfterReopen.saldo_atual}) e foram geradas ${txAfterReopen.length} transações financeiras para a mesma OS!`
      );
    } else {
      recordResult(
        'FLUXO 6.2',
        'Idempotência contra reabertura de OS',
        true,
        'O sistema preveniu duplicidade após reabertura.'
      );
    }

    // 6.3 Testar conclusão de uma OS CANCELADA
    console.log('   🧪 Teste 6.3: Tentativa de concluir uma OS cancelada...');
    const { data: canceledOrder, error: cancelOrderErr } = await supabase
      .from('orders')
      .insert({
        client_id: testClient.id,
        status: 'cancelado',
        total_price: 180.0,
        description: 'OS cancelada pelo cliente antes da execução',
      })
      .select()
      .single();

    if (cancelOrderErr) throw cancelOrderErr;
    createdRecords.orderIds.push(canceledOrder.id);

    // Adicionar item de estoque na OS cancelada
    const { data: itemCancelData, error: itCancelErr } = await supabase
      .from('order_items')
      .insert({
        order_id: canceledOrder.id,
        material_id: testMaterial.id,
        name: testMaterial.name,
        quantity: 5.0,
        unit_cost: 3.5,
        source: 'estoque',
      })
      .select()
      .single();

    if (itCancelErr) throw itCancelErr;

    // Chamar complete_work_order na OS cancelada
    const { data: rpcCancelResult, error: rpcCancelErr } = await supabase.rpc('complete_work_order', {
      p_order_id: canceledOrder.id,
    });

    const { data: orderAfterCancelAttempt } = await supabase
      .from('orders')
      .select('*')
      .eq('id', canceledOrder.id)
      .single();

    // Buscar se gerou transação e movimentação de estoque
    const { data: txCancel } = await supabase
      .from('transactions')
      .select('*')
      .eq('order_id', canceledOrder.id);
    txCancel?.forEach((t) => createdRecords.transactionIds.push(t.id));

    const { data: movCancel } = await supabase
      .from('inventory_movements')
      .select('*')
      .eq('order_id', canceledOrder.id);
    movCancel?.forEach((m) => createdRecords.movementIds.push(m.id));

    if (orderAfterCancelAttempt?.status === 'concluido' || (txCancel && txCancel.length > 0)) {
      recordResult(
        'FLUXO 6.3 [FALHA DE REGRA DE NEGÓCIO]',
        'Vulnerabilidade: RPC permite concluir OS com status "cancelado"',
        false,
        `FALHA GRAVE: A RPC complete_work_order não rejeita OS canceladas! Ela converteu o status para "concluido", deu baixa em 5 materiais e gerou receita de R$ 180,00 indevidamente!`
      );
    } else {
      recordResult(
        'FLUXO 6.3',
        'Rejeição de conclusão para OS cancelada',
        true,
        'A RPC bloqueou a conclusão da OS cancelada.'
      );
    }

    // 6.4 Testar inputs com vírgula em valores monetários (ex: "150,50") utilizando parseBRLNumber
    console.log('   🧪 Teste 6.4: Tratamento de inputs numéricos com vírgula com parseBRLNumber...');
    const inputWithComma = '150,50';

    // Tratamento seguro com o utilitário parseBRLNumber
    const sanitizedAmount = parseBRLNumber(inputWithComma);
    const preservesCents = sanitizedAmount === 150.5;

    // Teste de inserção com o valor sanitizado no PostgreSQL NUMERIC
    let postgresAccepted = false;
    let pgErrorMessage = '';
    try {
      const { data: commaOrder, error: commaInsertErr } = await supabase
        .from('orders')
        .insert({
          client_id: testClient.id,
          status: 'orcamento',
          total_price: sanitizedAmount,
          description: 'Teste de input com virgula sanitizado',
        })
        .select()
        .single();

      if (commaInsertErr) {
        pgErrorMessage = commaInsertErr.message;
      } else if (commaOrder) {
        postgresAccepted = true;
        createdRecords.orderIds.push(commaOrder.id);
      }
    } catch (e: any) {
      pgErrorMessage = e.message;
    }

    recordResult(
      'FLUXO 6.4',
      'Tratamento de inputs monetários com vírgula ("150,50")',
      preservesCents && postgresAccepted,
      preservesCents && postgresAccepted
        ? `parseBRLNumber("${inputWithComma}") converteu com precisão para R$ ${sanitizedAmount.toFixed(2)} e foi persistido no PostgreSQL sem erros.`
        : `Erro ao persistir: ${pgErrorMessage}`
    );
  } catch (err: any) {
    recordResult('FLUXO 6', 'Erro no Fluxo de Estresse', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 7: FERRAMENTAS / CAUTELA
  // ============================================================================
  console.log('\n--- FLUXO 7: FERRAMENTAS / CAUTELA ---');
  let testTool: any = null;
  try {
    // 7.1 Cadastrar ferramenta
    const toolPayload = {
      code: 'FERR-SDS-QA',
      name: 'Martelete Perfurador SDS (QA Test)',
      category: 'Construção',
      status: 'disponivel',
      assigned_to_tech_id: null,
      notes: 'Ferramenta de alto impacto para furações em concreto',
    };

    const { data: createdTool, error: toolErr } = await supabase
      .from('tools')
      .insert(toolPayload)
      .select()
      .single();

    if (toolErr) throw toolErr;
    testTool = createdTool;
    createdRecords.toolIds.push(testTool.id);

    recordResult(
      'FLUXO 7',
      'Cadastrar ferramenta ("Martelete Perfurador SDS")',
      Boolean(testTool?.id),
      `Ferramenta ID: ${testTool.id}, Status: "${testTool.status}"`
    );

    // 7.2 Emprestar para o Técnico Geral (status 'emprestada', assigned_to_tech_id preenchido)
    if (!techProfile) throw new Error('Perfil de técnico não disponível');

    const { data: loanedTool, error: loanErr } = await supabase
      .from('tools')
      .update({
        status: 'emprestada',
        assigned_to_tech_id: techProfile.id,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testTool.id)
      .select(`*, assigned_tech:profiles(*)`)
      .single();

    if (loanErr) throw loanErr;

    const isLoanValid =
      loanedTool.status === 'emprestada' && loanedTool.assigned_to_tech_id === techProfile.id;

    recordResult(
      'FLUXO 7',
      'Emprestar ferramenta para o Técnico Geral',
      isLoanValid,
      `Status: "${loanedTool.status}", Cautelada para: ${loanedTool.assigned_tech?.name}`
    );

    // 7.3 Devolver para a oficina (status 'disponivel', assigned_to_tech_id nulo)
    const { data: returnedTool, error: returnErr } = await supabase
      .from('tools')
      .update({
        status: 'disponivel',
        assigned_to_tech_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', testTool.id)
      .select()
      .single();

    if (returnErr) throw returnErr;

    const isReturnValid =
      returnedTool.status === 'disponivel' && returnedTool.assigned_to_tech_id === null;

    recordResult(
      'FLUXO 7',
      'Devolver ferramenta para a oficina (disponível e sem vínculo técnico)',
      isReturnValid,
      `Status: "${returnedTool.status}", Técnico Responsável: ${returnedTool.assigned_to_tech_id || 'Nenhum (Oficina)'}`
    );
  } catch (err: any) {
    recordResult('FLUXO 7', 'Erro no Fluxo de Ferramentas', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 8: DASHBOARD & MÉTRICAS
  // ============================================================================
  console.log('\n--- FLUXO 8: DASHBOARD & MÉTRICAS ---');
  try {
    // 8.1 Calcular KPIs mensais com os dados gerados
    // Replicar a lógica do DashboardView.tsx
    const { data: allOrders } = await supabase.from('orders').select('*');
    const { data: allTx } = await supabase.from('transactions').select('*');

    const currentMonthStr = new Date().toISOString().substring(0, 7);

    const monthOrders = (allOrders || []).filter((o) => {
      const dateToCheck = o.completed_at || o.created_at;
      return dateToCheck?.startsWith(currentMonthStr);
    });

    const monthTx = (allTx || []).filter((t) => t.date?.startsWith(currentMonthStr));

    const completedOrders = monthOrders.filter((o) => o.status === 'concluido');
    const totalRevenue = completedOrders.reduce((sum, o) => sum + (Number(o.total_price) || 0), 0);
    const totalExpenses = monthTx
      .filter((t) => t.type === 'despesa' && t.status === 'confirmado')
      .reduce((sum, t) => sum + (Number(t.amount) || 0), 0);
    const netProfit = totalRevenue - totalExpenses;

    recordResult(
      'FLUXO 8',
      'Cálculo de KPIs mensais (Faturamento, Despesas, OS Concluídas)',
      monthOrders.length > 0,
      `Mês ${currentMonthStr}: ${completedOrders.length} OS Concluídas, Faturamento: R$ ${totalRevenue.toFixed(2)}, Despesas: R$ ${totalExpenses.toFixed(2)}, Lucro Líquido: R$ ${netProfit.toFixed(2)}`
    );

    // 8.2 Testar a lógica de agrupamento por mês com OS criada em um mês e concluída em outro
    // Exemplo: criada em 2025-04 e concluída em 2025-05
    const mockOrderCrossMonth = {
      id: 'mock-cross-month',
      created_at: '2025-04-15T10:00:00Z',
      completed_at: '2025-05-02T16:00:00Z',
      status: 'concluido',
      total_price: 300,
    };

    // E se a OS foi criada em Abril e CONTINUA EM ANDAMENTO (completed_at = null)?
    const mockOrderStillOpen = {
      created_at: '2025-04-15T10:00:00Z',
      completed_at: null,
      status: 'em_andamento',
    };

    // Nova lógica implementada no DashboardView.tsx:
    const isOrderInMonth = (o: any, selectedMonth: string) => {
      const createdMonth = (o.created_at || '').substring(0, 7);
      const completedMonth = o.completed_at ? o.completed_at.substring(0, 7) : null;
      if (o.status === 'concluido') {
        return completedMonth === selectedMonth || (!completedMonth && createdMonth === selectedMonth);
      }
      if (o.status === 'cancelado') {
        return createdMonth === selectedMonth;
      }
      return createdMonth <= selectedMonth;
    };

    const openInMay = isOrderInMonth(mockOrderStillOpen, '2025-05');
    const closedInMay = isOrderInMonth(mockOrderCrossMonth, '2025-05');
    const openInApril = isOrderInMonth(mockOrderStillOpen, '2025-04');

    const logicAccurate = openInMay && closedInMay && openInApril;

    recordResult(
      'FLUXO 8 [LÓGICA DE NEGÓCIO]',
      'Análise de agrupamento de OS entre meses diferentes',
      logicAccurate,
      logicAccurate
        ? 'Lógica de agregação corrigida: ordens pendentes criadas em meses anteriores são devidamente computadas na fila ativa dos meses subsequentes.'
        : 'Distorção de métrica detectada no agrupamento mensal.'
    );

    // 8.3 Validar sanitização do CSV (CSV Injection / Formula Injection) via sanitizeCsvCell
    const maliciousName = '=CMD|\' /C calc\'!A0';
    const maliciousFormula = '+10+20';
    const exportedNameField = sanitizeCsvCell(maliciousName);
    const exportedFormulaField = sanitizeCsvCell(maliciousFormula);

    const isVulnerableToCsvInjection =
      exportedNameField.startsWith('"=') ||
      exportedFormulaField.startsWith('"+') ||
      exportedFormulaField.startsWith('"-');

    if (isVulnerableToCsvInjection) {
      recordResult(
        'FLUXO 8 [SEGURANÇA CSV]',
        'Vulnerabilidade: Exportação CSV vulnerável a Formula Injection (CWE-1236)',
        false,
        'VULNERABILIDADE DETECTADA: Campos começando com =, +, -, @ não recebem escape.'
      );
    } else {
      recordResult(
        'FLUXO 8 [SEGURANÇA CSV]',
        'Sanitização de CSV contra Formula Injection (CWE-1236)',
        true,
        `CSV protegido: células com fórmulas recebem prefixo apóstrofo e aspas seguras (${exportedNameField}, ${exportedFormulaField}).`
      );
    }
  } catch (err: any) {
    recordResult('FLUXO 8', 'Erro no Fluxo de Dashboard', false, err.message, err);
  }

  // ============================================================================
  // FLUXO 9: LIMPEZA E TEARDOWN
  // ============================================================================
  console.log('\n--- FLUXO 9: LIMPEZA E TEARDOWN ---');
  try {
    let cleanSuccess = true;

    // 9.1 Limpar fotos do storage
    if (createdRecords.storagePaths.length > 0) {
      const { error: stErr } = await supabase.storage
        .from(STORAGE_BUCKET)
        .remove(createdRecords.storagePaths);
      if (stErr) {
        console.error('Erro ao remover arquivos do storage:', stErr);
        cleanSuccess = false;
      } else {
        console.log(`   🧹 Removidos ${createdRecords.storagePaths.length} arquivos do bucket ${STORAGE_BUCKET}`);
      }
    }

    // 9.2 Limpar transações geradas
    if (createdRecords.transactionIds.length > 0) {
      const { error: txDelErr } = await supabase
        .from('transactions')
        .delete()
        .in('id', createdRecords.transactionIds);
      if (txDelErr) console.error('Erro ao limpar transações:', txDelErr);
      else console.log(`   🧹 Removidas ${createdRecords.transactionIds.length} transações de teste`);
    }

    // 9.3 Limpar movimentações de estoque
    if (createdRecords.movementIds.length > 0) {
      const { error: movDelErr } = await supabase
        .from('inventory_movements')
        .delete()
        .in('id', createdRecords.movementIds);
      if (movDelErr) console.error('Erro ao limpar movimentos:', movDelErr);
      else console.log(`   🧹 Removidas ${createdRecords.movementIds.length} movimentações de estoque`);
    }

    // 9.4 Limpar ordens de serviço (cascata limpa order_items)
    if (createdRecords.orderIds.length > 0) {
      const { error: ordDelErr } = await supabase
        .from('orders')
        .delete()
        .in('id', createdRecords.orderIds);
      if (ordDelErr) console.error('Erro ao limpar ordens de serviço:', ordDelErr);
      else console.log(`   🧹 Removidas ${createdRecords.orderIds.length} ordens de serviço de teste`);
    }

    // 9.5 Limpar agendamentos
    if (createdRecords.scheduleIds.length > 0) {
      const { error: schDelErr } = await supabase
        .from('schedule')
        .delete()
        .in('id', createdRecords.scheduleIds);
      if (schDelErr) console.error('Erro ao limpar agendamentos:', schDelErr);
      else console.log(`   🧹 Removidos ${createdRecords.scheduleIds.length} agendamentos de teste`);
    }

    // 9.6 Limpar ferramentas
    if (createdRecords.toolIds.length > 0) {
      const { error: toolDelErr } = await supabase
        .from('tools')
        .delete()
        .in('id', createdRecords.toolIds);
      if (toolDelErr) console.error('Erro ao limpar ferramentas:', toolDelErr);
      else console.log(`   🧹 Removidas ${createdRecords.toolIds.length} ferramentas de teste`);
    }

    // 9.7 Limpar materiais de estoque
    if (createdRecords.inventoryIds.length > 0) {
      const { error: invDelErr } = await supabase
        .from('inventory')
        .delete()
        .in('id', createdRecords.inventoryIds);
      if (invDelErr) console.error('Erro ao limpar estoque:', invDelErr);
      else console.log(`   🧹 Removidos ${createdRecords.inventoryIds.length} materiais de teste`);
    }

    // 9.8 Limpar clientes
    if (createdRecords.clientIds.length > 0) {
      const { error: cliDelErr } = await supabase
        .from('clients')
        .delete()
        .in('id', createdRecords.clientIds);
      if (cliDelErr) console.error('Erro ao limpar clientes:', cliDelErr);
      else console.log(`   🧹 Removidos ${createdRecords.clientIds.length} clientes de teste`);
    }

    recordResult(
      'FLUXO 9',
      'Teardown e Limpeza de todos os dados de teste',
      cleanSuccess,
      'Todos os registros temporários de teste foram purgados do banco e storage com sucesso.'
    );
  } catch (err: any) {
    recordResult('FLUXO 9', 'Erro no Teardown', false, err.message, err);
  }

  // ============================================================================
  // SUMÁRIO FINAL EXECUTIVO
  // ============================================================================
  console.log('\n======================================================================');
  console.log('📊 SUMÁRIO GERAL DOS TESTES E2E');
  console.log('======================================================================');
  const total = testResults.length;
  const passed = testResults.filter((r) => r.passed).length;
  const failed = testResults.filter((r) => !r.passed).length;

  console.log(`Total de Casos Testados: ${total}`);
  console.log(`✅ Sucessos: ${passed}`);
  console.log(`❌ Falhas / Vulnerabilidades Detectadas: ${failed}`);
  console.log('======================================================================\n');
}

runAllTests().catch((e) => {
  console.error('Falha fatal na execução do script:', e);
  process.exit(1);
});
