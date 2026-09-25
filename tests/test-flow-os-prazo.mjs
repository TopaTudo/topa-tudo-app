import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
const supabaseKey = 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Iniciando Teste E2E de OS a Prazo e A Combinar ---');

  // 1. Setup: Criar cliente e material de teste
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .insert({ name: '__TEST_CLIENT__', phone: '77999877314' })
    .select()
    .single();
  if (cErr) throw cErr;

  const { data: material, error: mErr } = await supabase
    .from('inventory')
    .insert({ name: '__TEST_MATERIAL__', min_stock: 0, cost_price: 10.0 })
    .select()
    .single();
  if (mErr) throw mErr;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);
  const due_date_str = [
    dueDate.getFullYear(),
    String(dueDate.getMonth() + 1).padStart(2, '0'),
    String(dueDate.getDate()).padStart(2, '0'),
  ].join('-');

  // 2. Criar OS com payment_method = 'prazo'
  const { data: orderPrazo, error: oErr } = await supabase
    .from('orders')
    .insert({
      client_id: client.id,
      description: 'Teste OS Prazo',
      total_price: 450.0,
      payment_method: 'prazo',
      due_date: due_date_str,
      status: 'orcamento',
    })
    .select()
    .single();
  if (oErr) throw oErr;

  const { error: itemErr } = await supabase.from('order_items').insert({
    order_id: orderPrazo.id,
    material_id: material.id,
    name: '__TEST_MATERIAL__',
    quantity: 1,
    unit_cost: 10.0,
    source: 'estoque',
  });
  if (itemErr) throw itemErr;

  console.log(`OS (Prazo) criada: ${orderPrazo.id}`);

  // 3. Executar RPC complete_work_order para OS a prazo
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('complete_work_order', {
    p_order_id: orderPrazo.id,
  });
  if (rpcErr) throw rpcErr;
  console.log('RPC resposta (Prazo):', rpcRes);

  // 4. Verificações da OS a Prazo
  const { data: finalOrder } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderPrazo.id)
    .single();
  console.log('Status OS (Prazo):', finalOrder.status);
  if (finalOrder.status !== 'concluido') throw new Error('Status incorreto na OS a prazo');

  const { data: transaction } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', orderPrazo.id)
    .single();
  console.log('Transação (Prazo):', transaction);
  if (transaction.payment_status !== 'pendente') {
    throw new Error(`Status de pagamento incorreto: ${transaction.payment_status}`);
  }
  if (transaction.due_date !== due_date_str) {
    throw new Error(`Data de vencimento incorreta: ${transaction.due_date} !== ${due_date_str}`);
  }

  const { data: movement } = await supabase
    .from('inventory_movements')
    .select('*')
    .eq('order_id', orderPrazo.id)
    .single();
  console.log('Movimento estoque:', movement);
  if (movement.type !== 'saida') throw new Error('Movimento incorreto');

  // 5. Simular Baixa da Duplicata ("Dar Baixa") e verificar persistência real
  const { error: baixaErr } = await supabase
    .from('transactions')
    .update({ payment_status: 'pago', status: 'confirmado' })
    .eq('id', transaction.id);
  if (baixaErr) throw baixaErr;

  const { data: txAfterBaixa, error: txVerifyErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('id', transaction.id)
    .single();
  if (txVerifyErr) throw txVerifyErr;
  if (txAfterBaixa.payment_status !== 'pago') {
    throw new Error('Baixa da duplicata não persistiu payment_status = pago');
  }
  console.log('✅ Baixa de duplicata (Prazo) persistida e verificada com sucesso.');

  // 6. Testar modalidade 'a_combinar' (sem due_date explícito -> fallback +30 dias na RPC)
  const { data: orderCombinar, error: oCombErr } = await supabase
    .from('orders')
    .insert({
      client_id: client.id,
      description: 'Teste OS A Combinar',
      total_price: 320.0,
      payment_method: 'a_combinar',
      due_date: null,
      status: 'em_andamento',
    })
    .select()
    .single();
  if (oCombErr) throw oCombErr;
  console.log(`OS (A Combinar) criada: ${orderCombinar.id}`);

  const { data: rpcCombRes, error: rpcCombErr } = await supabase.rpc('complete_work_order', {
    p_order_id: orderCombinar.id,
  });
  if (rpcCombErr) throw rpcCombErr;
  console.log('RPC resposta (A Combinar):', rpcCombRes);

  const { data: txCombinar, error: txCombErr } = await supabase
    .from('transactions')
    .select('*')
    .eq('order_id', orderCombinar.id)
    .single();
  if (txCombErr) throw txCombErr;
  if (txCombinar.payment_status !== 'pendente') {
    throw new Error('Transação A Combinar deveria iniciar como pendente');
  }
  console.log('✅ Duplicata A Combinar criada com sucesso:', {
    id: txCombinar.id,
    payment_status: txCombinar.payment_status,
    due_date: txCombinar.due_date,
  });

  // 7. Limpeza completa
  await supabase.from('inventory_movements').delete().eq('order_id', orderPrazo.id);
  await supabase.from('transactions').delete().eq('order_id', orderPrazo.id);
  await supabase.from('transactions').delete().eq('order_id', orderCombinar.id);
  await supabase.from('order_items').delete().eq('order_id', orderPrazo.id);
  await supabase.from('orders').delete().eq('id', orderPrazo.id);
  await supabase.from('orders').delete().eq('id', orderCombinar.id);
  await supabase.from('inventory').delete().eq('id', material.id);
  await supabase.from('clients').delete().eq('id', client.id);

  console.log('--- Teste E2E Concluído com Sucesso e Limpo ---');
}

runTest().catch((err) => {
  console.error('ERRO NO TESTE E2E:', err);
  process.exit(1);
});
