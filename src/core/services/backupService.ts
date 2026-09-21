import { supabase } from '@/core/supabase';

export interface BackupResult {
  filename: string;
  totalRecords: number;
  tablesCount: number;
  tablesSummary: Record<string, number>;
  createdAt: string;
  cloudSynced: boolean;
}

export interface StoredBackupFile {
  name: string;
  size: number;
  createdAt: string;
  isGzip: boolean;
}

export const CORE_TABLES = [
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
] as const;

/**
 * Gera um snapshot completo de todas as 10 tabelas do banco de dados,
 * dispara o download direto para o navegador e envia uma cópia para o bucket topatudo-backups.
 */
export async function generateAndDownloadBackup(
  userName?: string,
  onProgress?: (step: string) => void
): Promise<BackupResult> {
  onProgress?.('Iniciando extração das tabelas do banco de dados...');

  const backupData: Record<string, any[]> = {};
  const tablesSummary: Record<string, number> = {};
  let totalRecords = 0;

  for (const table of CORE_TABLES) {
    onProgress?.(`Extraindo dados da tabela '${table}'...`);
    const { data, error } = await supabase.from(table).select('*');
    if (error) {
      console.warn(`[Backup] Falha ao extrair tabela '${table}':`, error.message);
      backupData[table] = [];
      tablesSummary[table] = 0;
    } else {
      const rows = data || [];
      backupData[table] = rows;
      tablesSummary[table] = rows.length;
      totalRecords += rows.length;
    }
  }

  onProgress?.('Consolidando metadados e estruturando snapshot...');

  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, '0');
  const YYYY = now.getFullYear();
  const MM = pad(now.getMonth() + 1);
  const DD = pad(now.getDate());
  const filename = `backup_topatudo_${YYYY}-${MM}-${DD}.json`;

  const payload = {
    version: '1.0.0',
    app: 'Topa Tudo - Sistema de Gestão',
    created_at: now.toISOString(),
    exported_by: userName || 'Administrador',
    database: {
      tables_count: CORE_TABLES.length,
      total_records: totalRecords
    },
    tables_summary: tablesSummary,
    data: backupData
  };

  const jsonStr = JSON.stringify(payload, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  // 1. Download direto no navegador do administrador
  onProgress?.('Iniciando download do arquivo de backup...');
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  // 2. Enviar cópia de segurança para o bucket do Supabase Storage
  let cloudSynced = false;
  try {
    onProgress?.('Salvando cópia no bucket de segurança do Supabase...');
    const { error: uploadError } = await supabase.storage
      .from('topatudo-backups')
      .upload(filename, blob, {
        contentType: 'application/json',
        upsert: true
      });

    if (!uploadError) {
      cloudSynced = true;
    } else {
      console.warn('[Backup] Aviso: upload para o bucket retornou:', uploadError.message);
    }
  } catch (err) {
    console.warn('[Backup] Falha ao sincronizar cópia no bucket:', err);
  }

  onProgress?.('Backup concluído com sucesso!');

  return {
    filename,
    totalRecords,
    tablesCount: CORE_TABLES.length,
    tablesSummary,
    createdAt: payload.created_at,
    cloudSynced
  };
}

/**
 * Lista os arquivos de backup salvos no Supabase Storage
 */
export async function listStoredBackups(): Promise<StoredBackupFile[]> {
  try {
    const { data, error } = await supabase.storage
      .from('topatudo-backups')
      .list('', {
        limit: 50,
        sortBy: { column: 'name', order: 'desc' }
      });

    if (error) {
      console.error('[Backup] Erro ao listar backups no storage:', error);
      return [];
    }

    return (data || [])
      .filter((file) => file.name.startsWith('backup_') && !file.name.endsWith('.manifest.json'))
      .map((file) => ({
        name: file.name,
        size: file.metadata?.size || 0,
        createdAt: file.created_at || file.updated_at || '',
        isGzip: file.name.endsWith('.json.gz')
      }));
  } catch (err) {
    console.error('[Backup] Falha ao listar backups:', err);
    return [];
  }
}

/**
 * Baixa um backup armazenado no Supabase Storage diretamente para o navegador
 */
export async function downloadStoredBackup(filename: string): Promise<void> {
  const { data, error } = await supabase.storage
    .from('topatudo-backups')
    .download(filename);

  if (error || !data) {
    throw new Error(`Não foi possível baixar o backup: ${error?.message || 'Arquivo indisponível'}`);
  }

  const url = URL.createObjectURL(data);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
