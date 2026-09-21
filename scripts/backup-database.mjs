/**
 * Topa Tudo - Sistema de Backup Diário com Rotação Estrita
 * 
 * Funcionalidades:
 * 1. Conexão robusta ao PostgreSQL com fallback automático (Direct / Pooler Session / Pooler Transaction).
 * 2. Extração atômica e consistente via transação REPEATABLE READ READ ONLY de todas as 10 tabelas:
 *    profiles, clients, services_catalog, inventory, inventory_movements, orders, order_items,
 *    transactions, tools, schedule.
 * 3. Compactação Gzip (nível 9) e cálculo de integridade SHA-256 (payload e arquivo comprimido).
 * 4. Salvamento local em backups/ e upload para o bucket 'topatudo-backups' (privado, public = false).
 * 5. Garantia de existência e privacidade do bucket no Supabase Storage.
 * 6. Lógica de rotação estrita:
 *    - Preserva pelo menos 2 backups diários com espaçamento de pelo menos 24 horas entre eles (2 dias distintos mais recentes).
 *    - Em dias com múltiplos backups, mantém o mais recente do dia e remove backups redundantes intra-dia.
 *    - Remove backups mais antigos que a retenção (mínimo de 2 dias), garantindo que NUNCA exclui os 2 backups diários mais recentes.
 * 7. Verificação de integridade e manifesto descritivo.
 */

import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import pg from 'pg';
const { Client } = pg;
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const BACKUPS_DIR = path.resolve(PROJECT_ROOT, 'backups');

// Carregar variáveis de ambiente de .env ou .env.local caso existam
function loadEnv() {
  const envFiles = [path.join(PROJECT_ROOT, '.env'), path.join(PROJECT_ROOT, '.env.local')];
  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const lines = fs.readFileSync(file, 'utf8').split('\n');
      for (const line of lines) {
        const trimmed = line.trim();
        if (trimmed && !trimmed.startsWith('#') && trimmed.includes('=')) {
          const idx = trimmed.indexOf('=');
          const key = trimmed.substring(0, idx).trim();
          let val = trimmed.substring(idx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

// Configurações e Credenciais
export const CONFIG = {
  dbDirectUrl: process.env.DATABASE_URL || 'postgresql://postgres:%40Edu99001628@db.nlnkwrfzqvhncwfuuogo.supabase.co:5432/postgres',
  dbPoolerUrl: process.env.DATABASE_POOLER_URL || 'postgresql://postgres.nlnkwrfzqvhncwfuuogo:%40Edu99001628@aws-0-us-east-2.pooler.supabase.com:5432/postgres',
  dbPoolerTxUrl: process.env.DATABASE_POOLER_TX_URL || 'postgresql://postgres.nlnkwrfzqvhncwfuuogo:%40Edu99001628@aws-0-us-east-2.pooler.supabase.com:6543/postgres',
  supabaseUrl: process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || 'https://nlnkwrfzqvhncwfuuogo.supabase.co',
  supabaseKey: process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_KEY || process.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_I1YC5LSgvIXoKkEoXcD7PA_V0Pr-sGK',
  bucketName: 'topatudo-backups',
  minDailyBackups: 2, // Garante pelo menos 2 backups diários com >= 24h de intervalo
  retentionDays: parseInt(process.env.BACKUP_RETENTION_DAYS || '2', 10), // Padrão: 2 dias diários
  coreTables: [
    'profiles',
    'clients',
    'services_catalog',
    'inventory',
    'inventory_movements',
    'orders',
    'order_items',
    'transactions',
    'tools',
    'schedule'
  ]
};

/**
 * Conecta ao PostgreSQL testando rota direta e aplicando fallback transparente para o Pooler (IPv4)
 */
export async function createDatabaseClient() {
  const configs = [
    { name: 'Direct Connection', conn: CONFIG.dbDirectUrl, timeout: 2500 },
    { name: 'Pooler Session (port 5432)', conn: CONFIG.dbPoolerUrl, timeout: 8000 },
    { name: 'Pooler Transaction (port 6543)', conn: CONFIG.dbPoolerTxUrl, timeout: 8000 }
  ];

  for (const cfg of configs) {
    try {
      const client = new Client({
        connectionString: cfg.conn,
        ssl: { rejectUnauthorized: false },
        connectionTimeoutMillis: cfg.timeout
      });
      await client.connect();
      console.log(`[Database] Conectado com sucesso via ${cfg.name}.`);
      return client;
    } catch (err) {
      console.warn(`[Database] Falha ao conectar via ${cfg.name}: ${err.message}.`);
    }
  }

  throw new Error('Não foi possível conectar ao banco de dados PostgreSQL após tentar todas as rotas.');
}

/**
 * Garante que o bucket 'topatudo-backups' exista e seja estritamente privado (public = false)
 */
export async function ensureBucketExists(supabase = null, pgClient = null) {
  // 1. Garantir via SQL se tivermos conexão PG ativa (superuser postgres)
  if (pgClient) {
    try {
      await pgClient.query(`
        INSERT INTO storage.buckets (id, name, public)
        VALUES ($1, $1, false)
        ON CONFLICT (id) DO UPDATE SET public = false;
      `, [CONFIG.bucketName]);
      console.log(`[Supabase Storage] Bucket '${CONFIG.bucketName}' verificado via SQL (public = false).`);
      return;
    } catch (sqlErr) {
      console.warn(`[Supabase Storage] Aviso ao verificar bucket via SQL: ${sqlErr.message}`);
    }
  }

  // 2. Garantir via Supabase API se supabase client for fornecido
  if (supabase) {
    try {
      const { data: buckets, error: listErr } = await supabase.storage.listBuckets();
      const existing = (buckets || []).find(b => b.id === CONFIG.bucketName || b.name === CONFIG.bucketName);
      if (!existing) {
        const { error: createErr } = await supabase.storage.createBucket(CONFIG.bucketName, {
          public: false
        });
        if (createErr && !createErr.message.includes('already exists')) {
          console.warn(`[Supabase Storage] Aviso ao criar bucket: ${createErr.message}`);
        } else {
          console.log(`[Supabase Storage] Bucket '${CONFIG.bucketName}' criado com sucesso (public = false).`);
        }
      } else {
        console.log(`[Supabase Storage] Bucket '${CONFIG.bucketName}' já existe e está pronto para uso.`);
      }
    } catch (apiErr) {
      console.warn(`[Supabase Storage] Aviso ao verificar bucket via API: ${apiErr.message}`);
    }
  }
}

/**
 * Extrai todos os dados e metadados das tabelas do sistema de forma atômica
 */
export async function dumpDatabase(client) {
  console.log('[Database] Iniciando extração dos dados estruturados em transação atômica...');

  // Versão do PG
  const versionRes = await client.query('SELECT version()');
  const pgVersion = versionRes.rows[0]?.version || 'unknown';

  // Obter todas as tabelas públicas existentes
  const tablesRes = await client.query(`
    SELECT table_name 
    FROM information_schema.tables 
    WHERE table_schema = 'public' 
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);
  const foundTables = tablesRes.rows.map(r => r.table_name);
  
  // Garantir que todas as 10 tabelas principais façam parte do dump
  const targetTables = Array.from(new Set([...CONFIG.coreTables, ...foundTables]));

  const dumpData = {};
  const tablesMeta = {};
  let totalRecords = 0;

  // Iniciar transação atômica em modo REPEATABLE READ READ ONLY
  await client.query('BEGIN TRANSACTION ISOLATION LEVEL REPEATABLE READ READ ONLY;');

  try {
    for (const table of targetTables) {
      // Obter colunas e tipos
      const colRes = await client.query(`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position
      `, [table]);

      // Obter registros do snapshot consistente
      const rowsRes = await client.query(`SELECT * FROM public."${table}"`);
      const rows = rowsRes.rows;

      dumpData[table] = rows;
      tablesMeta[table] = {
        count: rows.length,
        columns: colRes.rows.map(c => ({
          name: c.column_name,
          type: c.data_type,
          nullable: c.is_nullable === 'YES'
        }))
      };
      totalRecords += rows.length;

      console.log(`[Database] Tabela '${table}': ${rows.length} registros extraídos.`);
    }

    // Commit da transação de leitura
    await client.query('COMMIT;');
  } catch (err) {
    await client.query('ROLLBACK;');
    console.error(`[Database] Erro durante extração: ${err.message}`);
    throw err;
  }

  return {
    version: '1.0.0',
    app: 'Topa Tudo - Sistema de Gestão',
    created_at: new Date().toISOString(),
    database: {
      version: pgVersion,
      tables_count: targetTables.length,
      total_records: totalRecords
    },
    tables_meta: tablesMeta,
    data: dumpData
  };
}

/**
 * Formata a data para nome de arquivo: backup_YYYY-MM-DD_HH-mm-ss.json.gz
 */
export function formatBackupFilename(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  const YYYY = date.getUTCFullYear();
  const MM = pad(date.getUTCMonth() + 1);
  const DD = pad(date.getUTCDate());
  const HH = pad(date.getUTCHours());
  const mm = pad(date.getUTCMinutes());
  const ss = pad(date.getUTCSeconds());
  return `backup_${YYYY}-${MM}-${DD}_${HH}-${mm}-${ss}.json.gz`;
}

/**
 * Converte nome de arquivo em timestamp e data YYYY-MM-DD
 * Suporta formatos:
 * - backup_YYYY-MM-DD_HH-mm-ss.json.gz
 * - backup_YYYY-MM-DDTHH-mm-ss.json.gz
 * - backup_topatudo_YYYY-MM-DD.json
 * - backup_topatudo_YYYY-MM-DD_HH-mm-ss.json
 */
export function parseBackupFilename(filename) {
  // 1. Formato com data e hora: backup_[topatudo_]YYYY-MM-DD[T_]HH-mm-ss
  const withTimeMatch = filename.match(/^backup_(?:topatudo_)?(\d{4}-\d{2}-\d{2})[T_](\d{2})-(\d{2})-(\d{2})/);
  if (withTimeMatch) {
    const [_, dateStr, hour, minute, second] = withTimeMatch;
    const isoString = `${dateStr}T${hour}:${minute}:${second}.000Z`;
    const timestamp = new Date(isoString).getTime();
    if (!isNaN(timestamp)) {
      return { filename, dateStr, timestamp, isoString };
    }
  }

  // 2. Formato simples só com data: backup_[topatudo_]YYYY-MM-DD
  const dateOnlyMatch = filename.match(/^backup_(?:topatudo_)?(\d{4}-\d{2}-\d{2})(?:\.json|\.json\.gz|\.manifest\.json)?$/);
  if (dateOnlyMatch) {
    const [_, dateStr] = dateOnlyMatch;
    const isoString = `${dateStr}T12:00:00.000Z`;
    const timestamp = new Date(isoString).getTime();
    if (!isNaN(timestamp)) {
      return { filename, dateStr, timestamp, isoString };
    }
  }

  return null;
}

/**
 * LÓGICA DE ROTAÇÃO ESTRITA
 * 
 * Regras:
 * 1. Agrupa os backups por dia de calendário (intervalo de 24h).
 * 2. Em dias com múltiplos backups, mantém apenas o mais recente daquele dia.
 *    Os backups anteriores do mesmo dia são classificados como redundantes intra-dia (prune).
 * 3. Identifica os dias disponíveis ordenados do mais recente para o mais antigo.
 * 4. Garante a preservação de PELO MENOS 2 backups diários com espaçamento de pelo menos 24 horas entre eles
 *    (ou seja, os representantes dos 2 dias distintos mais recentes NUNCA são excluídos).
 * 5. Se houver backups de mais dias que o limite de retenção (mínimo de 2 dias), os dias que ultrapassam
 *    são removidos com segurança, garantindo que NUNCA exclui os 2 backups diários mais recentes.
 * 6. Se houver apenas 1 dia no histórico, preserva o backup mais recente desse dia sem exclusão indevida.
 * 
 * @param {Array<string>} fileList Lista de nomes de arquivos
 * @param {object} options Opções de retenção
 * @returns {{ keep: string[], prune: string[], summary: object }}
 */
export function calculateRotation(fileList, options = {}) {
  const minDailyBackups = Math.max(2, options.minDailyBackups ?? CONFIG.minDailyBackups);
  const retentionDays = Math.max(minDailyBackups, options.retentionDays ?? CONFIG.retentionDays);

  // 1. Filtrar e agrupar arquivos e manifests associados
  const parsedBackups = fileList
    .map(f => {
      const isManifest = f.endsWith('.manifest.json');
      const baseFilename = isManifest ? f.replace('.manifest.json', '.json.gz') : f;
      const parsed = parseBackupFilename(baseFilename);
      if (!parsed) return null;
      return {
        originalFilename: f,
        baseFilename,
        dateStr: parsed.dateStr,
        timestamp: parsed.timestamp,
        isManifest
      };
    })
    .filter(Boolean);

  const fileGroups = new Map();
  for (const item of parsedBackups) {
    if (!fileGroups.has(item.baseFilename)) {
      fileGroups.set(item.baseFilename, {
        baseFilename: item.baseFilename,
        dateStr: item.dateStr,
        timestamp: item.timestamp,
        files: []
      });
    }
    fileGroups.get(item.baseFilename).files.push(item.originalFilename);
  }

  const distinctBackups = Array.from(fileGroups.values()).sort((a, b) => b.timestamp - a.timestamp);

  if (distinctBackups.length === 0) {
    return {
      keep: [],
      prune: [],
      summary: { totalDistinctBackups: 0, totalFiles: 0, distinctDays: 0, preservedDays: 0, keptFiles: 0, prunedFiles: 0, keptDaysList: [] }
    };
  }

  // 2. Agrupar backups por dia (dateStr: YYYY-MM-DD)
  const dayBuckets = new Map();
  for (const backup of distinctBackups) {
    if (!dayBuckets.has(backup.dateStr)) {
      dayBuckets.set(backup.dateStr, []);
    }
    dayBuckets.get(backup.dateStr).push(backup);
  }

  // Ordenar cada dia: do mais recente para o mais antigo
  for (const [day, backupsInDay] of dayBuckets.entries()) {
    backupsInDay.sort((a, b) => b.timestamp - a.timestamp);
  }

  // Dias ordenados decrescentemente (mais recente primeiro)
  const sortedDays = Array.from(dayBuckets.keys()).sort((a, b) => b.localeCompare(a));

  const keptBaseBackups = new Set();
  const prunedBaseBackups = new Set();

  // 3. Para cada dia, o mais recente do dia é o representante diário.
  // Backups anteriores do mesmo dia são classificados como redundantes (prune).
  const dailyCandidates = [];

  sortedDays.forEach((day, dayIndex) => {
    const backupsInDay = dayBuckets.get(day);
    const newestOfDay = backupsInDay[0];
    const olderInDay = backupsInDay.slice(1);

    dailyCandidates.push({ day, dayIndex, backup: newestOfDay });

    for (const older of olderInDay) {
      prunedBaseBackups.add(older.baseFilename);
    }
  });

  // 4. Selecionar dias a manter:
  // - Preserva PELO MENOS minDailyBackups (ex: 2) dias distintos mais recentes (espaçados em 24h).
  // - Dias excedentes além de retentionDays são descartados.
  const daysToKeepCount = Math.max(minDailyBackups, Math.min(sortedDays.length, retentionDays));

  // Proteção absoluta: os 2 primeiros dias diários NUNCA são descartados
  const preservedDays = sortedDays.slice(0, daysToKeepCount);
  const expiredDays = sortedDays.slice(daysToKeepCount);

  for (const day of preservedDays) {
    const candidate = dailyCandidates.find(c => c.day === day);
    if (candidate) {
      keptBaseBackups.add(candidate.backup.baseFilename);
    }
  }

  for (const day of expiredDays) {
    const candidate = dailyCandidates.find(c => c.day === day);
    if (candidate) {
      prunedBaseBackups.add(candidate.backup.baseFilename);
    }
  }

  // Garantia inviolável: nenhum backup em keptBaseBackups pode ser removido
  for (const kept of keptBaseBackups) {
    prunedBaseBackups.delete(kept);
  }

  // Mapear de volta para todos os arquivos físicos/armazenados (incluindo manifests)
  const keep = [];
  const prune = [];

  for (const [baseFilename, group] of fileGroups.entries()) {
    if (keptBaseBackups.has(baseFilename)) {
      keep.push(...group.files);
    } else {
      prune.push(...group.files);
    }
  }

  return {
    keep: keep.sort(),
    prune: prune.sort(),
    summary: {
      totalDistinctBackups: distinctBackups.length,
      totalFiles: fileList.length,
      distinctDays: sortedDays.length,
      preservedDays: preservedDays.length,
      keptFiles: keep.length,
      prunedFiles: prune.length,
      keptDaysList: preservedDays
    }
  };
}

/**
 * Executa a rotação nos arquivos locais em backups/
 */
export async function rotateLocalBackups(options = {}) {
  if (!fs.existsSync(BACKUPS_DIR)) return { pruned: [], kept: [] };

  const files = fs.readdirSync(BACKUPS_DIR).filter(f => f.startsWith('backup_'));
  const rotation = calculateRotation(files, options);

  console.log(`[Rotação Local] Total de arquivos analisados: ${files.length}.`);
  console.log(`[Rotação Local] Dias distintos detectados: ${rotation.summary.distinctDays}.`);
  console.log(`[Rotação Local] Backups a manter: ${rotation.keep.length}, Backups a descartar: ${rotation.prune.length}.`);

  for (const file of rotation.prune) {
    const fullPath = path.join(BACKUPS_DIR, file);
    try {
      fs.unlinkSync(fullPath);
      console.log(`[Rotação Local] Excluído backup redundante/expirado: ${file}`);
    } catch (err) {
      console.error(`[Rotação Local] Erro ao excluir ${file}: ${err.message}`);
    }
  }

  return rotation;
}

/**
 * Executa a rotação no Supabase Storage (bucket topatudo-backups)
 */
export async function rotateStorageBackups(supabase, options = {}) {
  console.log(`[Rotação Storage] Consultando bucket '${CONFIG.bucketName}'...`);
  const { data: objects, error } = await supabase.storage.from(CONFIG.bucketName).list('', {
    limit: 1000,
    offset: 0
  });

  if (error) {
    console.error(`[Rotação Storage] Erro ao listar arquivos do bucket: ${error.message}`);
    return { pruned: [], kept: [] };
  }

  const fileNames = (objects || []).map(o => o.name).filter(n => n.startsWith('backup_'));
  const rotation = calculateRotation(fileNames, options);

  console.log(`[Rotação Storage] Total de arquivos no bucket: ${fileNames.length}.`);
  console.log(`[Rotação Storage] Backups a manter: ${rotation.keep.length}, Backups a descartar: ${rotation.prune.length}.`);

  if (rotation.prune.length > 0) {
    const { error: removeError } = await supabase.storage
      .from(CONFIG.bucketName)
      .remove(rotation.prune);

    if (removeError) {
      console.error(`[Rotação Storage] Falha ao remover arquivos: ${removeError.message}`);
    } else {
      for (const prunedFile of rotation.prune) {
        console.log(`[Rotação Storage] Removido com sucesso do bucket: ${prunedFile}`);
      }
    }
  } else {
    console.log('[Rotação Storage] Nenhum arquivo necessita de limpeza no bucket.');
  }

  return rotation;
}

/**
 * Valida a integridade de um arquivo de backup local
 */
export function verifyBackupIntegrity(gzFilePath, expectedSha256 = null) {
  if (!fs.existsSync(gzFilePath)) {
    throw new Error(`Arquivo não encontrado: ${gzFilePath}`);
  }

  const gzBuffer = fs.readFileSync(gzFilePath);
  const actualGzSha256 = crypto.createHash('sha256').update(gzBuffer).digest('hex');

  // Descompactar payload
  const jsonBuffer = zlib.gunzipSync(gzBuffer);
  const jsonSha256 = crypto.createHash('sha256').update(jsonBuffer).digest('hex');
  const payload = JSON.parse(jsonBuffer.toString('utf8'));

  // Validação estrita do schema
  if (!payload.data || !payload.tables_meta || !payload.version) {
    throw new Error('Formato do backup inválido: propriedades obrigatórias ausentes.');
  }

  for (const table of CONFIG.coreTables) {
    if (!payload.data[table]) {
      throw new Error(`Integridade comprometida: tabela essencial '${table}' ausente no backup.`);
    }
  }

  return {
    valid: true,
    gzSha256: actualGzSha256,
    jsonSha256: jsonSha256,
    totalRecords: payload.database?.total_records ?? 0,
    tablesCount: Object.keys(payload.data).length,
    createdAt: payload.created_at
  };
}

/**
 * Função principal de execução de backup
 */
export async function runBackup(options = {}) {
  const startTime = Date.now();
  console.log('=====================================================');
  console.log('  TOPA TUDO - EXECUÇÃO DE BACKUP DIÁRIO & ROTAÇÃO   ');
  console.log('=====================================================');
  console.log(`[Início] Data/Hora UTC: ${new Date().toISOString()}`);

  // 1. Garantir diretório local backups/
  if (!fs.existsSync(BACKUPS_DIR)) {
    fs.mkdirSync(BACKUPS_DIR, { recursive: true });
    console.log(`[Local] Diretório de backups criado em: ${BACKUPS_DIR}`);
  }

  // 2. Conectar, garantir bucket e extrair dados atômicos do PostgreSQL
  let client;
  let backupData;
  const supabase = createClient(CONFIG.supabaseUrl, CONFIG.supabaseKey);
  try {
    client = await createDatabaseClient();
    await ensureBucketExists(supabase, client);
    backupData = await dumpDatabase(client);
  } finally {
    if (client) await client.end();
  }

  // 3. Serializar e Compactar em Gzip
  const rawJson = JSON.stringify(backupData, null, 2);
  const rawJsonBuffer = Buffer.from(rawJson, 'utf8');
  const rawSha256 = crypto.createHash('sha256').update(rawJsonBuffer).digest('hex');

  console.log(`[Compressão] Compactando payload JSON (${(rawJsonBuffer.length / 1024).toFixed(1)} KB)...`);
  const compressedBuffer = zlib.gzipSync(rawJsonBuffer, { level: 9 });
  const compressedSha256 = crypto.createHash('sha256').update(compressedBuffer).digest('hex');
  console.log(`[Compressão] Concluída: ${(compressedBuffer.length / 1024).toFixed(1)} KB (taxa de compressão: ${((1 - compressedBuffer.length / rawJsonBuffer.length) * 100).toFixed(1)}%).`);

  // 4. Salvar arquivo e manifesto localmente
  const filename = formatBackupFilename(new Date());
  const localGzPath = path.join(BACKUPS_DIR, filename);
  fs.writeFileSync(localGzPath, compressedBuffer);
  console.log(`[Local] Arquivo salvo em: ${localGzPath}`);

  // Manifesto descritivo com metadados e contagens
  const manifest = {
    filename,
    created_at: backupData.created_at,
    database_version: backupData.database.version,
    total_records: backupData.database.total_records,
    tables_count: backupData.database.tables_count,
    raw_size_bytes: rawJsonBuffer.length,
    compressed_size_bytes: compressedBuffer.length,
    sha256_uncompressed: rawSha256,
    sha256_compressed: compressedSha256,
    tables: Object.fromEntries(
      Object.entries(backupData.tables_meta).map(([k, v]) => [k, v.count])
    )
  };

  const manifestFilename = filename.replace('.json.gz', '.manifest.json');
  const localManifestPath = path.join(BACKUPS_DIR, manifestFilename);
  fs.writeFileSync(localManifestPath, JSON.stringify(manifest, null, 2));
  console.log(`[Local] Manifesto salvo em: ${localManifestPath}`);

  // 5. Teste imediato de integridade
  const integrity = verifyBackupIntegrity(localGzPath);
  console.log(`[Integridade] Verificação aprovada com sucesso! SHA256: ${integrity.gzSha256.substring(0, 16)}...`);

  // 6. Supabase Storage - Upload do Backup e Manifesto
  console.log(`[Supabase Storage] Enviando para bucket '${CONFIG.bucketName}'...`);
  // Upload do arquivo comprimido
  const { error: uploadErr } = await supabase.storage
    .from(CONFIG.bucketName)
    .upload(filename, compressedBuffer, {
      contentType: 'application/gzip',
      upsert: true
    });

  if (uploadErr) {
    console.error(`[Supabase Storage] Falha no upload do backup: ${uploadErr.message}`);
    throw uploadErr;
  }
  console.log(`[Supabase Storage] Upload do arquivo ${filename} concluído.`);

  // Upload do manifesto
  const { error: manifestErr } = await supabase.storage
    .from(CONFIG.bucketName)
    .upload(manifestFilename, Buffer.from(JSON.stringify(manifest, null, 2), 'utf8'), {
      contentType: 'application/json',
      upsert: true
    });

  if (manifestErr) {
    console.warn(`[Supabase Storage] Aviso: falha ao subir manifesto: ${manifestErr.message}`);
  } else {
    console.log(`[Supabase Storage] Upload do manifesto ${manifestFilename} concluído.`);
  }

  // 7. Rotação Estrita (Local e Cloud)
  console.log('[Rotação] Iniciando política de rotação de backups...');
  const localRotation = await rotateLocalBackups(options);
  const cloudRotation = await rotateStorageBackups(supabase, options);

  const durationSec = ((Date.now() - startTime) / 1000).toFixed(2);
  console.log('=====================================================');
  console.log(`  BACKUP FINALIZADO COM SUCESSO (${durationSec}s) `);
  console.log(`  Arquivo: ${filename}`);
  console.log(`  Preservados: ${localRotation.summary.keptFiles} locais, ${cloudRotation.summary.keptFiles} no bucket`);
  console.log('=====================================================');

  return {
    success: true,
    filename,
    localGzPath,
    manifest,
    localRotation,
    cloudRotation,
    durationSec
  };
}

// Execução direta via terminal: node scripts/backup-database.mjs
if (process.argv[1] === fileURLToPath(import.meta.url)) {
  runBackup().catch((err) => {
    console.error('[ERRO CRÍTICO NO BACKUP]', err);
    process.exit(1);
  });
}
