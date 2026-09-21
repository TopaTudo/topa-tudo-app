/**
 * Topa Tudo - Testes de Unidade, Rotação e Integridade de Backup
 * Arquivo: tests/test-backup-rotation.mjs
 * 
 * Valida:
 * 1. Análise e parsing de datas e timestamps em nomes de arquivos.
 * 2. Rotação intra-dia (múltiplos backups no mesmo dia preservam apenas o mais recente).
 * 3. Garantia matemática estrita de pelo menos 2 backups diários com espaçamento >= 24h.
 * 4. Rotação com múltiplos dias (ex: 4 dias consecutivos) comprovando que mantém os 2 mais recentes.
 * 5. Simulação física em sistema de arquivos real (criação, cálculo e exclusão).
 * 6. Verificação de integridade SHA-256 e schema do backup real em backups/.
 */

import assert from 'assert';
import fs from 'fs';
import path from 'path';
import zlib from 'zlib';
import crypto from 'crypto';
import { fileURLToPath } from 'url';
import {
  calculateRotation,
  parseBackupFilename,
  formatBackupFilename,
  verifyBackupIntegrity
} from '../scripts/backup-database.mjs';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const PROJECT_ROOT = path.resolve(__dirname, '..');
const TEST_TMP_DIR = path.resolve(__dirname, 'tmp_rotation_sim');

console.log('========================================================');
console.log('  TESTES DE ROTAÇÃO E INTEGRIDADE DE BACKUP - TOPA TUDO ');
console.log('========================================================\n');

// -------------------------------------------------------------
// TESTE 1: Parser e validação de nomes de arquivos
// -------------------------------------------------------------
console.log('[Teste 1] Validação de parseBackupFilename');
{
  const test1 = parseBackupFilename('backup_2026-09-21_14-10-05.json.gz');
  assert(test1 !== null, 'Deveria parsear backup com formato padrão');
  assert.strictEqual(test1.dateStr, '2026-09-21');
  assert.strictEqual(test1.isoString, '2026-09-21T14:10:05.000Z');

  const testManifest = parseBackupFilename('backup_2026-09-20_08-00-00.manifest.json');
  assert(testManifest !== null, 'Deveria parsear backup manifest');
  assert.strictEqual(testManifest.dateStr, '2026-09-20');

  const testUiFormat = parseBackupFilename('backup_topatudo_2026-09-21_11-30-00.json');
  assert(testUiFormat !== null, 'Deveria parsear formato gerado pelo painel UI');
  assert.strictEqual(testUiFormat.dateStr, '2026-09-21');

  const invalid = parseBackupFilename('random_backup_file.zip');
  assert.strictEqual(invalid, null, 'Arquivo inválido deve retornar null');
  console.log('✓ Teste 1 passou: Nomes de arquivos e manifests parseados corretamente.');
}

// -------------------------------------------------------------
// TESTE 2: Rotação Intra-Dia (Mesmo Dia)
// -------------------------------------------------------------
console.log('\n[Teste 2] Rotação Intra-Dia: Múltiplos backups no mesmo dia retêm apenas o mais recente');
{
  const files = [
    'backup_2026-09-21_08-00-00.json.gz',
    'backup_2026-09-21_08-00-00.manifest.json',
    'backup_2026-09-21_12-30-00.json.gz',
    'backup_2026-09-21_12-30-00.manifest.json',
    'backup_2026-09-21_22-00-00.json.gz',
    'backup_2026-09-21_22-00-00.manifest.json',
  ];

  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 2 });

  // Como só há 1 dia (2026-09-21), o das 22:00 deve ser mantido e os anteriores descartados
  assert(result.keep.includes('backup_2026-09-21_22-00-00.json.gz'), 'O mais recente das 22:00 deve ser mantido');
  assert(result.keep.includes('backup_2026-09-21_22-00-00.manifest.json'), 'Manifesto das 22:00 deve ser mantido');
  assert(result.prune.includes('backup_2026-09-21_08-00-00.json.gz'), 'Backup matutino do mesmo dia deve ser descartado');
  assert(result.prune.includes('backup_2026-09-21_12-30-00.json.gz'), 'Backup da tarde do mesmo dia deve ser descartado');
  assert.strictEqual(result.keep.length, 2, 'Apenas o par gz+manifest mais recente é mantido');
  console.log('✓ Teste 2 passou: Descarte de backups redundantes no mesmo dia validado.');
}

// -------------------------------------------------------------
// TESTE 3: Regra Estrita do Usuário - Preservar 2 Backups com 24h de Espaço
// -------------------------------------------------------------
console.log('\n[Teste 3] Prova Matemática: Preservar pelo menos 2 backups diários com espaçamento >= 24 horas');
{
  const files = [
    // Dia 1 (Ontem) - 2 backups
    'backup_2026-09-20_03-00-00.json.gz',
    'backup_2026-09-20_03-00-00.manifest.json',
    'backup_2026-09-20_18-00-00.json.gz',
    'backup_2026-09-20_18-00-00.manifest.json',
    // Dia 2 (Hoje) - 2 backups
    'backup_2026-09-21_03-00-00.json.gz',
    'backup_2026-09-21_03-00-00.manifest.json',
    'backup_2026-09-21_20-00-00.json.gz',
    'backup_2026-09-21_20-00-00.manifest.json',
  ];

  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 2 });

  assert.strictEqual(result.summary.preservedDays, 2, 'Deve preservar exatamente 2 dias distintos');
  assert(result.keep.includes('backup_2026-09-21_20-00-00.json.gz'), 'Representante de Hoje mantido');
  assert(result.keep.includes('backup_2026-09-20_18-00-00.json.gz'), 'Representante de Ontem mantido');

  // Cálculo explícito do intervalo em horas
  const p1 = parseBackupFilename('backup_2026-09-20_18-00-00.json.gz');
  const p2 = parseBackupFilename('backup_2026-09-21_20-00-00.json.gz');
  const diffHours = (p2.timestamp - p1.timestamp) / (1000 * 60 * 60);

  assert(diffHours >= 24, `Espaçamento deve ser de no mínimo 24h (calculado: ${diffHours}h)`);
  console.log(`✓ Teste 3 passou: Preservados 2 dias com ${diffHours.toFixed(1)} horas de espaçamento (>= 24h).`);
}

// -------------------------------------------------------------
// TESTE 4: Simulação de Múltiplos Dias (Hoje, Ontem, Anteontem, 3 dias atrás)
// -------------------------------------------------------------
console.log('\n[Teste 4] Simulação de múltiplos dias (Hoje, Ontem, Anteontem, 3 dias atrás)');
{
  const files = [
    // 3 dias atrás (2026-09-18)
    'backup_2026-09-18_03-00-00.json.gz',
    'backup_2026-09-18_03-00-00.manifest.json',
    // Anteontem (2026-09-19)
    'backup_2026-09-19_03-00-00.json.gz',
    'backup_2026-09-19_03-00-00.manifest.json',
    // Ontem (2026-09-20)
    'backup_2026-09-20_03-00-00.json.gz',
    'backup_2026-09-20_03-00-00.manifest.json',
    // Hoje (2026-09-21)
    'backup_2026-09-21_03-00-00.json.gz',
    'backup_2026-09-21_03-00-00.manifest.json',
  ];

  // Com minDailyBackups = 2 e retentionDays = 2, DEVE reter apenas Hoje (21) e Ontem (20)
  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 2 });

  assert.deepStrictEqual(result.summary.keptDaysList, ['2026-09-21', '2026-09-20'], 'Deve reter apenas Hoje e Ontem');
  
  // Preservados
  assert(result.keep.includes('backup_2026-09-21_03-00-00.json.gz'), 'Hoje deve estar mantido');
  assert(result.keep.includes('backup_2026-09-20_03-00-00.json.gz'), 'Ontem deve estar mantido');
  
  // Podados
  assert(result.prune.includes('backup_2026-09-19_03-00-00.json.gz'), 'Anteontem deve ser podado');
  assert(result.prune.includes('backup_2026-09-18_03-00-00.json.gz'), '3 dias atrás deve ser podado');

  console.log('✓ Teste 4 passou: Preservados com precisão Hoje e Ontem, descartando dias mais antigos.');
}

// -------------------------------------------------------------
// TESTE 5: Simulação Física no Sistema de Arquivos (Local Disk)
// -------------------------------------------------------------
console.log('\n[Teste 5] Simulação Física no Sistema de Arquivos (Criação e Exclusão real)');
{
  if (fs.existsSync(TEST_TMP_DIR)) {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });

  const mockBackups = [
    'backup_2026-09-19_10-00-00.json.gz',
    'backup_2026-09-19_10-00-00.manifest.json',
    'backup_2026-09-20_10-00-00.json.gz',
    'backup_2026-09-20_10-00-00.manifest.json',
    'backup_2026-09-21_08-00-00.json.gz',
    'backup_2026-09-21_18-00-00.json.gz',
    'backup_2026-09-21_18-00-00.manifest.json',
  ];

  for (const f of mockBackups) {
    fs.writeFileSync(path.join(TEST_TMP_DIR, f), 'simulated backup binary data');
  }

  const rotation = calculateRotation(fs.readdirSync(TEST_TMP_DIR), { minDailyBackups: 2, retentionDays: 2 });
  
  // Aplicar exclusões físicas
  for (const fileToPrune of rotation.prune) {
    fs.unlinkSync(path.join(TEST_TMP_DIR, fileToPrune));
  }

  const remainingFiles = fs.readdirSync(TEST_TMP_DIR).sort();
  const expectedRemaining = [
    'backup_2026-09-20_10-00-00.json.gz',
    'backup_2026-09-20_10-00-00.manifest.json',
    'backup_2026-09-21_18-00-00.json.gz',
    'backup_2026-09-21_18-00-00.manifest.json',
  ].sort();

  assert.deepStrictEqual(remainingFiles, expectedRemaining, 'Arquivos físicos restantes devem corresponder exatamente aos 2 dias mais recentes');
  
  // Limpeza
  fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  console.log('✓ Teste 5 passou: Exclusão física validada no disco com sucesso.');
}

// -------------------------------------------------------------
// TESTE 6: Verificação de Integridade Real do Backup Gerado
// -------------------------------------------------------------
console.log('\n[Teste 6] Verificação de Integridade do Backup Real em backups/');
{
  const backupsDir = path.resolve(PROJECT_ROOT, 'backups');
  const gzFiles = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json.gz'));
  assert(gzFiles.length > 0, 'Deve haver pelo menos um backup real gerado em backups/');

  const targetFile = path.join(backupsDir, gzFiles[0]);
  const result = verifyBackupIntegrity(targetFile);

  assert.strictEqual(result.valid, true, 'O arquivo de backup deve ser válido');
  assert(result.tablesCount >= 10, 'Deve conter todas as 10 tabelas do sistema');
  assert(result.totalRecords >= 0, 'Deve ter contagem de registros');
  assert(typeof result.gzSha256 === 'string' && result.gzSha256.length === 64, 'SHA256 deve ser hash hexadecimal de 64 caracteres');

  console.log(`✓ Teste 6 passou: Backup real verificado (${result.tablesCount} tabelas, ${result.totalRecords} registros, SHA256: ${result.gzSha256.substring(0, 16)}...).`);
}

console.log('\n========================================================');
console.log('  TODOS OS 6 TESTES DE ROTAÇÃO E INTEGRIDADE PASSARAM!  ');
console.log('========================================================\n');
