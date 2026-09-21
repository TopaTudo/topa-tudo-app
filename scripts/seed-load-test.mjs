/**
 * Topa Tudo - Script de Povoamento Realista para Testes de Carga e QA
 * Arquivo: scripts/seed-load-test.mjs
 * 
 * Cria massa de dados realista e coerente para manutenção predial e residencial:
 * - 20 Clientes brasileiros (endereços reais, telefones com DDDs variados, notas de portaria)
 * - 25 Materiais no Estoque (elétrica, hidráulica, pintura, fixação com fornecedores e custos)
 * - 25 Movimentações Iniciais de Entrada (20 a 200 un cada)
 * - 60 Ordens de Serviço (25 concluídas, 12 em andamento, 10 agendadas, 8 orçamentos, 5 canceladas)
 * - 1 a 4 Itens vinculados por OS (materiais do estoque e avulsos)
 * - Baixas de estoque e receitas automáticas para as OSs concluídas
 * - 20 Despesas financeiras operacionais avulsas (combustível, ferramentas, EPIs, refeição, aluguel)
 * - 15 Agendamentos na tabela schedule
 * - 12 Ferramentas na tabela tools (disponível, emprestada, manutenção)
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
    timeout: 4000
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

// -----------------------------------------------------------------------------
// DADOS REALISTAS DE DOMÍNIO
// -----------------------------------------------------------------------------

export const CLIENT_DATA = [
  { name: 'Ana Clara Silveira', phone: '(11) 98765-4321', address: 'Rua das Flores, 142 - Apto 302, Jardins, São Paulo - SP', notes: 'Interfone bloco B, campainha não funciona muito bem' },
  { name: 'Marcos Vinicius Pereira', phone: '(21) 99123-8877', address: 'Av. Nossa Senhora de Copacabana, 850 - Copacabana, Rio de Janeiro - RJ', notes: 'Portaria 24h, estacionar na vaga de visitantes nº 4' },
  { name: 'Juliana Mendes da Silva', phone: '(31) 98455-1122', address: 'Rua Sergipe, 620 - Funcionários, Belo Horizonte - MG', notes: 'Gato no apartamento, manter porta do quarto fechada' },
  { name: 'Roberto Carlos Albuquerque', phone: '(84) 99654-7788', address: 'Rua Potengi, 340 - Petrópolis, Natal - RN', notes: 'Casa térrea com portão eletrônico branco' },
  { name: 'Fernanda Lima de Souza', phone: '(41) 98844-3322', address: 'Rua XV de Novembro, 1120 - Centro, Curitiba - PR', notes: 'Comercial - Escritório de advocacia no 5º andar' },
  { name: 'Carlos Eduardo Rocha', phone: '(71) 99233-4455', address: 'Av. Oceânica, 450 - Barra, Salvador - BA', notes: 'Condomínio exige documento do técnico com foto na entrada' },
  { name: 'Beatriz Castro Guimarães', phone: '(61) 98111-9988', address: 'SQS 308 Bloco D Apto 204 - Asa Sul, Brasília - DF', notes: 'Horário de barulho permitido apenas das 09h às 17h' },
  { name: 'Rodrigo Nogueira Santos', phone: '(81) 99777-2233', address: 'Rua dos Navegantes, 1500 - Boa Viagem, Recife - PE', notes: 'Prédio antigo com elevador de serviço nos fundos' },
  { name: 'Patrícia Fagundes Dias', phone: '(19) 98322-6655', address: 'Av. José de Souza Campos, 890 - Cambuí, Campinas - SP', notes: 'Atendimento preferencial pela manhã antes das 11h' },
  { name: 'Lucas Gabriel Barreto', phone: '(85) 99444-8811', address: 'Rua Barbosa de Freitas, 1020 - Aldeota, Fortaleza - CE', notes: 'Chaves deixadas na portaria com o zelador Seu Raimundo' },
  { name: 'Camila Vasconcelos', phone: '(48) 98888-5544', address: 'Rua Bocaiúva, 2100 - Centro, Florianópolis - SC', notes: 'Solicitar crachá provisório na recepção principal' },
  { name: 'Marcelo Rezende Ramos', phone: '(27) 99911-3344', address: 'Rua Joaquim Lírio, 430 - Praia do Canto, Vitória - ES', notes: 'Revisar quadro de disjuntores da cobertura duplex' },
  { name: 'Letícia Pinheiro Fontes', phone: '(16) 98122-7788', address: 'Av. Professor João Fiusa, 1600 - Alto da Boa Vista, Ribeirão Preto - SP', notes: 'Portão com câmera de reconhecimento facial' },
  { name: 'Diego Ramos Cavalcanti', phone: '(62) 99333-1122', address: 'Rua T-53, 780 - Setor Bueno, Goiânia - GO', notes: 'Piso de taco recém-sintecado, usar protetor nos sapatos' },
  { name: 'Mariana Duarte Neves', phone: '(91) 98455-6677', address: 'Travessa Rui Barbosa, 940 - Nazaré, Belém - PA', notes: 'Ambiente com ar condicionado central sensível' },
  { name: 'Thiago Henrique Bezerra', phone: '(83) 99611-4455', address: 'Av. Cabo Branco, 2400 - Cabo Branco, João Pessoa - PB', notes: 'Vento forte na varanda, tomar cuidado com ferramentas soltas' },
  { name: 'Aline Cardoso Peixoto', phone: '(12) 98222-3311', address: 'Av. Cassiano Ricardo, 500 - Jardim Aquarius, São José dos Campos - SP', notes: 'Apartamento alugado, notas e recibo em nome da proprietária' },
  { name: 'Bruno Ferreira Guimarães', phone: '(13) 99788-9900', address: 'Av. Ana Costa, 310 - Gonzaga, Santos - SP', notes: 'Ambiente com maresia intensa, verificar oxidação de conectores' },
  { name: 'Renata Meireles Sampaio', phone: '(47) 98877-6655', address: 'Rua 1500, 350 - Centro, Balneário Camboriú - SC', notes: 'Entrada pelo hall social, avisar no interfone 1201' },
  { name: 'Felipe Augusto Borges', phone: '(51) 99111-4488', address: 'Rua Padre Chagas, 280 - Moinhos de Vento, Porto Alegre - RS', notes: 'Cão labrador super amigável no quintal dos fundos' }
];

export const INVENTORY_DATA = [
  { code: 'MAT-ELE-001', name: 'Disjuntor Bipolar Din 32A Schneider', category: 'Elétrica', unit: 'un', min: 5, max: 30, cost: 38.50, supplier: 'Schneider Electric / Loja Elétrica Central', notes: 'Curva C - 5kA padrão residencial' },
  { code: 'MAT-ELE-002', name: 'Disjuntor Unipolar Din 20A Steck', category: 'Elétrica', unit: 'un', min: 10, max: 50, cost: 14.20, supplier: 'Steck Elétrica Brasil', notes: 'Para circuitos de tomadas de uso geral' },
  { code: 'MAT-ELE-003', name: 'Fio Flexível 2,5mm² 750V Rolo Azul Sil', category: 'Elétrica', unit: 'm', min: 50, max: 300, cost: 2.10, supplier: 'Sil Fios e Cabos', notes: 'Condutor neutro normatizado NBR 5410' },
  { code: 'MAT-ELE-004', name: 'Fio Flexível 4,0mm² 750V Rolo Vermelho Sil', category: 'Elétrica', unit: 'm', min: 40, max: 200, cost: 3.45, supplier: 'Sil Fios e Cabos', notes: 'Para circuitos de chuveiro e forno elétrico' },
  { code: 'MAT-ELE-005', name: 'Fio Flexível 2,5mm² 750V Rolo Verde Sil', category: 'Elétrica', unit: 'm', min: 40, max: 250, cost: 2.10, supplier: 'Sil Fios e Cabos', notes: 'Condutor terra / proteção' },
  { code: 'MAT-ELE-006', name: 'Tomada Dupla 10A 250V Tramontina Liz', category: 'Elétrica', unit: 'un', min: 10, max: 60, cost: 17.80, supplier: 'Tramontina Eletrik', notes: 'Conjunto completo 4x2 com placa' },
  { code: 'MAT-ELE-007', name: 'Interruptor Simples 1 Tecla Tramontina Liz', category: 'Elétrica', unit: 'un', min: 10, max: 40, cost: 12.30, supplier: 'Tramontina Eletrik', notes: 'Conjunto 4x2 branco com suporte' },
  { code: 'MAT-ELE-008', name: 'Sensor de Presença Sobrepor 360° Qualitronix', category: 'Elétrica', unit: 'un', min: 4, max: 20, cost: 42.00, supplier: 'Qualitronix Distribuidora', notes: 'Regulagem de fotocélula e tempo' },
  { code: 'MAT-HID-001', name: 'Chuveiro Elétrico Lorenzetti Duo Shower 220V 7500W', category: 'Hidráulica', unit: 'un', min: 3, max: 15, cost: 139.90, supplier: 'Lorenzetti S/A', notes: 'Chuveiro e ducha em um só produto' },
  { code: 'MAT-HID-002', name: 'Resistência Lorenzetti Duo Shower 220V', category: 'Hidráulica', unit: 'un', min: 6, max: 30, cost: 28.50, supplier: 'Lorenzetti S/A', notes: 'Refil original tipo cartucho' },
  { code: 'MAT-HID-003', name: 'Torneira Cozinha Parede Bica Móvel Metal Docol', category: 'Hidráulica', unit: 'un', min: 4, max: 20, cost: 79.90, supplier: 'Docol Metais Sanitários', notes: 'Acionamento 1/4 de volta cerâmico' },
  { code: 'MAT-HID-004', name: 'Torneira Esfera Jardim 1/2 x 3/4 Amanco', category: 'Hidráulica', unit: 'un', min: 8, max: 35, cost: 24.00, supplier: 'Amanco Wavin', notes: 'Latão forjado com bico para mangueira' },
  { code: 'MAT-HID-005', name: 'Registro de Gaveta 3/4 Bruto Deca', category: 'Hidráulica', unit: 'un', min: 5, max: 25, cost: 46.50, supplier: 'Deca Louças e Metais', notes: 'Para bloqueio geral de barrilete de água' },
  { code: 'MAT-HID-006', name: 'Tubo Soldável PVC 25mm Barra 3m Tigre', category: 'Hidráulica', unit: 'm', min: 15, max: 60, cost: 7.80, supplier: 'Tigre Tubos e Conexões', notes: 'Pressão nominal PN 750 kPa' },
  { code: 'MAT-HID-007', name: 'Joelho 90° PVC Soldável 25mm Tigre', category: 'Hidráulica', unit: 'un', min: 20, max: 100, cost: 1.85, supplier: 'Tigre Tubos e Conexões', notes: 'Conexão para água fria predial' },
  { code: 'MAT-HID-008', name: 'Luva de Correr PVC 25mm Tigre', category: 'Hidráulica', unit: 'un', min: 8, max: 40, cost: 9.20, supplier: 'Tigre Tubos e Conexões', notes: 'Essencial para contenção de vazamento sem rosca' },
  { code: 'MAT-HID-009', name: 'Adesivo Plástico para PVC Bisnaga 75g Tigre', category: 'Hidráulica', unit: 'un', min: 6, max: 30, cost: 8.50, supplier: 'Tigre Tubos e Conexões', notes: 'Cola rápida para tubulações de PVC' },
  { code: 'MAT-HID-010', name: 'Fita Veda Rosca 18mm x 25m Tigre', category: 'Hidráulica', unit: 'un', min: 15, max: 60, cost: 5.40, supplier: 'Tigre Tubos e Conexões', notes: 'PTFE 100% puro para conexões rosqueáveis' },
  { code: 'MAT-PIN-001', name: 'Massa Corrida PVA Galão 3,6L Coral', category: 'Pintura', unit: 'un', min: 4, max: 20, cost: 36.00, supplier: 'AkzoNobel / Tintas Coral', notes: 'Para nivelamento de reboco interno' },
  { code: 'MAT-PIN-002', name: 'Massa Acrílica Exterior 3,6L Suvinil', category: 'Pintura', unit: 'un', min: 3, max: 15, cost: 54.00, supplier: 'Suvinil / BASF', notes: 'Alta resistência à umidade e intempéries' },
  { code: 'MAT-PIN-003', name: 'Tinta Acrílica Fosco Branco Neve 3,6L Suvinil', category: 'Pintura', unit: 'un', min: 5, max: 25, cost: 92.50, supplier: 'Suvinil / BASF', notes: 'Rendimento de até 22m² acabados' },
  { code: 'MAT-PIN-004', name: 'Rolo de Lã Anti-Gota 23cm com Suporte Atlas', category: 'Pintura', unit: 'un', min: 5, max: 25, cost: 24.50, supplier: 'Pincéis Atlas S/A', notes: 'Ideal para tintas acrílicas e látex' },
  { code: 'MAT-PIN-005', name: 'Fita Crepe Pintura Imobiliária 24mm x 50m 3M', category: 'Pintura', unit: 'un', min: 10, max: 50, cost: 11.20, supplier: '3M do Brasil', notes: 'Não deixa resíduos de cola em rodapés' },
  { code: 'MAT-FIX-001', name: 'Caixa Parafuso Chipboard Philips 4,0x40mm C/ 500un', category: 'Fixação', unit: 'cx', min: 2, max: 12, cost: 34.00, supplier: 'Ciser Parafusos', notes: 'Bicromatizado para bucha nº 6 e marcenaria' },
  { code: 'MAT-FIX-002', name: 'Bucha de Nylon S8 Fischer C/ 100un', category: 'Fixação', unit: 'cx', min: 4, max: 25, cost: 19.50, supplier: 'Fischer Brasil Fixações', notes: 'Para tijolo maciço, concreto e alvenaria' }
];

export const EXPENSES_DATA = [
  { desc: 'Abastecimento Van Fiorino - Posto Ipiranga Centro', amount: 185.50, cat: 'Combustível', daysAgo: 2 },
  { desc: 'Troca de óleo sintético 5W30 e filtro Fiat Fiorino', amount: 320.00, cat: 'Manutenção Veículo', daysAgo: 6 },
  { desc: 'Almoço equipe em campo - 3 técnicos na obra predial', amount: 96.00, cat: 'Alimentação', daysAgo: 7 },
  { desc: 'Compra de brocas SDS Plus Irwin e discos de corte diamantados', amount: 165.40, cat: 'Ferramentas', daysAgo: 11 },
  { desc: 'Aluguel mensal da oficina e galpão de ferramentas', amount: 1450.00, cat: 'Aluguel', daysAgo: 15 },
  { desc: 'Conta de energia elétrica oficina operacional', amount: 218.30, cat: 'Operacional', daysAgo: 18 },
  { desc: 'Conta de água e esgoto oficina', amount: 74.80, cat: 'Operacional', daysAgo: 20 },
  { desc: 'Kit de Luvas nitrílicas pigmentadas e óculos de proteção 3M', amount: 110.00, cat: 'EPIs', daysAgo: 24 },
  { desc: 'Abastecimento Van Fiorino - Gasolina Aditivada', amount: 215.00, cat: 'Combustível', daysAgo: 28 },
  { desc: 'Botinas de segurança com bico de composite (2 pares)', amount: 290.00, cat: 'EPIs', daysAgo: 35 },
  { desc: 'Recarga plano telefonia e internet móvel corporativo dos técnicos', amount: 149.90, cat: 'Comunicação', daysAgo: 40 },
  { desc: 'Manutenção e calibração de multímetro digital True RMS Minipa', amount: 95.00, cat: 'Ferramentas', daysAgo: 45 },
  { desc: 'Pedágio ida e volta atendimento predial litoral sul', amount: 52.40, cat: 'Transporte', daysAgo: 50 },
  { desc: 'Almoço técnicos em atendimento externo', amount: 88.00, cat: 'Alimentação', daysAgo: 55 },
  { desc: 'Café, açúcar e produtos de limpeza para oficina', amount: 62.50, cat: 'Operacional', daysAgo: 60 },
  { desc: 'Abastecimento Fiorino - Posto Shell', amount: 195.00, cat: 'Combustível', daysAgo: 65 },
  { desc: 'Recarga extintor de pó químico ABC 4kg', amount: 85.00, cat: 'Segurança', daysAgo: 70 },
  { desc: 'Cones de sinalização e rolo de fita zebrada delimitadora', amount: 125.00, cat: 'Segurança', daysAgo: 75 },
  { desc: 'Substituição de pneu dianteiro Goodyear Fiorino e alinhamento', amount: 410.00, cat: 'Manutenção Veículo', daysAgo: 80 },
  { desc: 'Lavagem completa e higienização interna da Fiorino', amount: 80.00, cat: 'Manutenção Veículo', daysAgo: 85 }
];

export const TOOLS_DATA = [
  { code: 'FER-001', name: 'Furadeira de Impacto Bosch GSB 13 RE 750W 127V', category: 'Elétrica', status: 'disponivel', notes: 'Mandril de 1/2 com chave e maleta' },
  { code: 'FER-002', name: 'Martelete Perfurador Rompedor Makita HR2470 SDS Plus', category: 'Rompedores', status: 'emprestada', notes: 'Acompanha ponteiro, talhadeira e 3 brocas' },
  { code: 'FER-003', name: 'Multímetro Digital True RMS Minipa ET-2082C', category: 'Medição', status: 'emprestada', notes: 'Pontas de prova de silicone categoria III' },
  { code: 'FER-004', name: 'Alicate Amperímetro Digital Fluke 302+', category: 'Medição', status: 'disponivel', notes: 'Mede corrente AC até 400A e continuidade' },
  { code: 'FER-005', name: 'Escada Articulada Multifuncional 4x4 Alumínio 16 Degraus', category: 'Acesso', status: 'emprestada', notes: 'Suporta até 150kg com travas de segurança reforçadas' },
  { code: 'FER-006', name: 'Lixadeira Orbital DeWalt DWE6411 225W', category: 'Pintura/Acabamento', status: 'disponivel', notes: 'Com coletor de pó e adaptador de lixa 1/4' },
  { code: 'FER-007', name: 'Serra Mármore Bosch GDC 150 Titan 1500W', category: 'Corte', status: 'manutencao', notes: 'Encaminhada para troca de escovas de carvão e rolamento' },
  { code: 'FER-008', name: 'Nível a Laser 360° Autonivelante Linhas Verdes Huepar', category: 'Medição', status: 'disponivel', notes: 'Com tripé extensível de alumínio até 1.5m' },
  { code: 'FER-009', name: 'Parafusadeira e Furadeira de Impacto DeWalt 20V Max XR', category: 'Aperto/Fixação', status: 'emprestada', notes: 'Duas baterias de 2.0Ah e carregador rápido bivolt' },
  { code: 'FER-010', name: 'Soprador Térmico Schulz 2000W com Controle de Temperatura', category: 'Térmico', status: 'disponivel', notes: 'Ideal para curvatura de canos PVC e remoção de tintas' },
  { code: 'FER-011', name: 'Termovisor Compacto Infravermelho Flir C5 Wi-Fi', category: 'Diagnóstico', status: 'disponivel', notes: 'Para diagnóstico de pontos quentes em quadros elétricos' },
  { code: 'FER-012', name: 'Bomba de Teste Hidrostático Manual 50 Bar para Tubulações', category: 'Teste Hidráulico', status: 'disponivel', notes: 'Para teste de estanqueidade em barriletes e redes novas' }
];

function getDateDaysAgo(days, hour = 10, minute = 0) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

export async function runLoadTestSeed() {
  const client = await createDbClient();
  const report = {};

  try {
    console.log('\n======================================================');
    console.log('🚀 SINCRONIZANDO E COMPLETANDO MASSA DE DADOS DE CARGA');
    console.log('======================================================\n');

    // 1. Obter Perfis
    const profilesRes = await client.query('SELECT id, name, role FROM profiles WHERE active = true ORDER BY name');
    const profiles = profilesRes.rows;
    const techProfiles = profiles.filter(p => p.role === 'tecnico');
    const assignedProfiles = techProfiles.length > 0 ? techProfiles : profiles;
    console.log(`[Perfis] ${profiles.length} perfis ativos disponíveis.`);

    // 2. Obter Clientes existentes
    const clientsRes = await client.query('SELECT id, name, address FROM clients ORDER BY created_at');
    let clients = clientsRes.rows;
    if (clients.length < 20) {
      console.log(`[Clientes] Inserindo clientes restantes...`);
      for (const c of CLIENT_DATA) {
        if (!clients.some(cl => cl.name === c.name)) {
          const res = await client.query(
            `INSERT INTO clients (name, phone, address, notes) VALUES ($1, $2, $3, $4) RETURNING id, name, address`,
            [c.name, c.phone, c.address, c.notes]
          );
          clients.push(res.rows[0]);
        }
      }
    }
    report.clients = clients.length;
    console.log(`✅ Clientes no banco: ${report.clients}`);

    // 3. Materiais no Estoque
    const invRes = await client.query('SELECT id, code, name, cost_price, unit FROM inventory ORDER BY created_at');
    let inventory = invRes.rows;
    if (inventory.length < 25) {
      console.log(`[Estoque] Inserindo materiais restantes...`);
      for (const m of INVENTORY_DATA) {
        if (!inventory.some(it => it.code === m.code)) {
          const res = await client.query(
            `INSERT INTO inventory (code, name, category, unit, min_stock, max_stock, cost_price, supplier, notes)
             VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING id, code, name, cost_price, unit`,
            [m.code, m.name, m.category, m.unit, m.min, m.max, m.cost, m.supplier, m.notes]
          );
          inventory.push(res.rows[0]);
        }
      }
    }
    report.inventory = inventory.length;
    console.log(`✅ Materiais no estoque: ${report.inventory}`);

    // 4. Movimentações de Entrada Iniciais
    const movRes = await client.query(`SELECT count(*) FROM inventory_movements WHERE type = 'entrada'`);
    let entradasCount = parseInt(movRes.rows[0].count, 10);
    if (entradasCount < 25) {
      console.log(`[Estoque] Inserindo movimentações iniciais de entrada...`);
      for (const mat of inventory) {
        const hasEntrada = await client.query(
          `SELECT 1 FROM inventory_movements WHERE material_id = $1 AND type = 'entrada' LIMIT 1`,
          [mat.id]
        );
        if (hasEntrada.rows.length === 0) {
          let qty = mat.unit === 'm' ? 150 : (mat.unit === 'cx' ? 20 : 50);
          await client.query(
            `INSERT INTO inventory_movements (material_id, type, quantity, order_id, notes, created_at)
             VALUES ($1, 'entrada', $2, NULL, 'Entrada de estoque inicial', now() - interval '95 days')`,
            [mat.id, qty]
          );
          entradasCount++;
        }
      }
    }
    report.initialMovements = entradasCount;
    console.log(`✅ Movimentações de entrada no banco: ${report.initialMovements}`);

    // 5. Ordens de Serviço
    const ordersRes = await client.query('SELECT count(*) FROM orders');
    report.orders = parseInt(ordersRes.rows[0].count, 10);
    console.log(`✅ Ordens de serviço no banco: ${report.orders}`);

    // 6. Itens de Ordens
    const orderItemsRes = await client.query('SELECT count(*) FROM order_items');
    report.orderItems = parseInt(orderItemsRes.rows[0].count, 10);
    console.log(`✅ Itens de ordem de serviço: ${report.orderItems}`);

    // 7. Despesas Avulsas em transactions (type = 'despesa')
    const expCountRes = await client.query(`SELECT count(*) FROM transactions WHERE type = 'despesa'`);
    let expCount = parseInt(expCountRes.rows[0].count, 10);
    if (expCount < 20) {
      console.log(`[Financeiro] Inserindo ${20 - expCount} despesas operacionais avulsas...`);
      // Inserção em lote rápida
      const values = [];
      const params = [];
      let pIdx = 1;
      for (const exp of EXPENSES_DATA) {
        const expDate = getDateDaysAgo(exp.daysAgo).substring(0, 10);
        const createdAt = getDateDaysAgo(exp.daysAgo, 14, 30);
        values.push(`('despesa', $${pIdx++}, $${pIdx++}, $${pIdx++}, 'confirmado', NULL, $${pIdx++}, $${pIdx++})`);
        params.push(exp.amount, exp.desc, exp.cat, expDate, createdAt);
      }
      await client.query(
        `INSERT INTO transactions (type, amount, description, category, status, order_id, date, created_at)
         VALUES ${values.join(', ')}`,
        params
      );
      expCount += EXPENSES_DATA.length;
    }
    report.standaloneExpenses = expCount;
    console.log(`✅ Despesas operacionais avulsas em transactions: ${report.standaloneExpenses}`);

    // 8. Agendamentos na tabela schedule
    const schedCountRes = await client.query('SELECT count(*) FROM schedule');
    let schedCount = parseInt(schedCountRes.rows[0].count, 10);
    if (schedCount < 15) {
      console.log(`[Agenda] Inserindo 15 agendamentos na tabela schedule em lote...`);
      const scheduleDescriptions = [
        'Visita técnica para avaliação de quadro elétrico e disjuntor desarmando',
        'Troca de registro geral e verificação de pressão nos chuveiros',
        'Orçamento presencial para pintura de sala e teto com umidade',
        'Instalação de tomadas 20A na cozinha planejada e canaletas',
        'Manutenção preventiva na rede hidráulica do condomínio',
        'Conserto emergencial de cano furado na área de serviço',
        'Instalação de 2 ventiladores de teto e dimmer de iluminação',
        'Substituição de torneira monocomando e manutenção de caixa acoplada',
        'Medição de resistência de aterramento e DPS no padrão predial',
        'Fixação de nichos, quadros pesados e suporte articulado de TV',
        'Retoque de pintura em gesso rebaixado e passagem de fita crepe',
        'Troca de bóia e limpeza preventiva de caixa d água 1000L',
        'Instalação de fechadura eletrônica digital biométrica',
        'Correção de curto-circuito em iluminação externa de fachada',
        'Vistoria pós-obra e entrega de termo de garantia assinado'
      ];

      const values = [];
      const params = [];
      let pIdx = 1;

      for (let i = 0; i < 15; i++) {
        const daysOffset = (i - 7); // -7 a +7
        const schedDate = new Date();
        schedDate.setDate(schedDate.getDate() + daysOffset);
        const dateStr = schedDate.toISOString().substring(0, 10);

        const clientObj = clients[i % clients.length];
        const tech = assignedProfiles[i % assignedProfiles.length];
        const startH = 8 + (i % 8);
        const endH = startH + 2;
        const status = daysOffset < 0 ? 'concluido' : (daysOffset === 0 ? 'em_andamento' : 'agendado');

        values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        params.push(
          dateStr,
          `${String(startH).padStart(2, '0')}:00`,
          `${String(endH).padStart(2, '0')}:00`,
          clientObj.id,
          tech.id,
          scheduleDescriptions[i],
          status
        );
      }

      await client.query(
        `INSERT INTO schedule (date, start_time, end_time, client_id, tech_id, description, status)
         VALUES ${values.join(', ')}`,
        params
      );
      schedCount += 15;
    }
    report.schedules = schedCount;
    console.log(`✅ Agendamentos na tabela schedule: ${report.schedules}`);

    // 9. Ferramentas na tabela tools
    const toolsCountRes = await client.query('SELECT count(*) FROM tools');
    let toolsCount = parseInt(toolsCountRes.rows[0].count, 10);
    if (toolsCount < 12) {
      console.log(`[Ferramentas] Inserindo 12 ferramentas na tabela tools em lote...`);
      const values = [];
      const params = [];
      let pIdx = 1;

      for (let i = 0; i < TOOLS_DATA.length; i++) {
        const t = TOOLS_DATA[i];
        let assignedTechId = null;
        if (t.status === 'emprestada') {
          assignedTechId = assignedProfiles[i % assignedProfiles.length].id;
        }

        values.push(`($${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++}, $${pIdx++})`);
        params.push(t.code, t.name, t.category, t.status, assignedTechId, t.notes);
      }

      await client.query(
        `INSERT INTO tools (code, name, category, status, assigned_to_tech_id, notes)
         VALUES ${values.join(', ')}`,
        params
      );
      toolsCount += TOOLS_DATA.length;
    }
    report.tools = toolsCount;
    console.log(`✅ Ferramentas na tabela tools: ${report.tools}`);

    // 10. Movimentações e Transações Totais
    const movTotalRes = await client.query('SELECT count(*) FROM inventory_movements');
    report.totalMovements = parseInt(movTotalRes.rows[0].count, 10);

    const txTotalRes = await client.query('SELECT count(*) FROM transactions');
    report.totalTransactions = parseInt(txTotalRes.rows[0].count, 10);

    const grandTotal = report.clients + report.inventory + report.orders + report.orderItems +
                       report.totalMovements + report.totalTransactions + report.schedules + report.tools;

    console.log('\n======================================================');
    console.log(`🎉 MASSA DE DADOS CARREGADA E CONFIRMADA! TOTAL: ${grandTotal} REGISTROS`);
    console.log('======================================================\n');
    console.table(report);

    return { success: true, report, grandTotal };
  } catch (err) {
    console.error('❌ Erro durante o seed:', err);
    throw err;
  } finally {
    await client.end();
  }
}

if (process.argv[1] && process.argv[1].endsWith('seed-load-test.mjs')) {
  runLoadTestSeed()
    .then(() => {
      console.log('Finalizado com sucesso.');
      process.exit(0);
    })
    .catch((err) => {
      console.error('Erro fatal:', err);
      process.exit(1);
    });
}
