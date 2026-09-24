import { createClient } from '@supabase/supabase-js';
// import 'dotenv/config';

// Assumindo variáveis de ambiente configuradas no ambiente de execução
const supabaseUrl = 'https://nlnkwrfzqvhncwfuuogo.supabase.co';
const supabaseKey = 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK';
const supabase = createClient(supabaseUrl, supabaseKey);

async function runTest() {
  console.log('--- Iniciando Teste E2E de OS a Prazo ---');

  // 1. Setup: Criar cliente, material e OS
  const { data: client, error: cErr } = await supabase
    .from('clients')
    .insert({ name: '__TEST_CLIENT__', phone: '00000000000' })
    .select()
    .single();
  if (cErr) throw cErr;

  const { data: material, error: mErr } = await supabase
    .from('inventory')
    .insert({ name: '__TEST_MATERIAL__', min_stock: 0, cost_price: 10.00 })
    .select()
    .single();
  if (mErr) throw mErr;

  const dueDate = new Date();
  dueDate.setDate(dueDate.getDate() + 15);
  const due_date_str = dueDate.toISOString().split('T')[0];

  const { data: order, error: oErr } = await supabase
    .from('orders')
    .insert({
      client_id: client.id,
      description: 'Teste OS Prazo',
      total_price: 450.00,
      payment_method: 'prazo',
      due_date: due_date_str,
      status: 'orcamento'
    })
    .select()
    .single();
  if (oErr) throw oErr;

  await supabase.from('order_items').insert({
    order_id: order.id,
    material_id: material.id,
    name: '__TEST_MATERIAL__',
    quantity: 1,
    unit_cost: 10.00,
    source: 'estoque'
  });

  console.log(`OS criada: ${order.id}`);

  // 2. Executar RPC
  const { data: rpcRes, error: rpcErr } = await supabase.rpc('complete_work_order', { p_order_id: order.id });
  if (rpcErr) throw rpcErr;
  console.log('RPC resposta:', rpcRes);

  // 3. Verificações
  const { data: finalOrder } = await supabase.from('orders').select('*').eq('id', order.id).single();
  console.log('Status OS:', finalOrder.status);
  if (finalOrder.status !== 'concluido') throw new Error('Status incorreto');

  const { data: transaction } = await supabase.from('transactions').select('*').eq('order_id', order.id).single();
  console.log('Transação:', transaction);
  if (transaction.payment_status !== 'pendente') throw new Error('Status de pagamento incorreto');
  if (transaction.due_date !== due_date_str) throw new Error('Data de vencimento incorreta');

  const { data: movement } = await supabase.from('inventory_movements').select('*').eq('order_id', order.id).single();
  console.log('Movimento estoque:', movement);
  if (movement.type !== 'saida') throw new Error('Movimento incorreto');

  // 4. Simular Baixa
  await supabase.from('transactions').update({ payment_status: 'pago', paid_at: new Date().toISOString() }).eq('id', transaction.id);
  console.log('Baixa de duplicata realizada.');

  // 5. Limpeza
  await supabase.from('inventory_movements').delete().eq('order_id', order.id);
  await supabase.from('transactions').delete().eq('order_id', order.id);
  await supabase.from('order_items').delete().eq('order_id', order.id);
  await supabase.from('orders').delete().eq('id', order.id);
  await supabase.from('inventory').delete().eq('id', material.id);
  await supabase.from('clients').delete().eq('id', client.id);

  console.log('--- Teste Concluído com Sucesso e Limpo ---');
}

runTest().catch(console.error);
