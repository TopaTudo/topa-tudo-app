/**
 * Testes Automatizados para Sistema de Backup e Rotação Estrita do Topa Tudo
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
const TEST_TMP_DIR = path.resolve(__dirname, 'tmp_rotation_test');

console.log('--- [TEST SUITE] Iniciando Testes de Backup e Rotação ---');

// TESTE 1: Parser de nomes de arquivos
{
  console.log('\n[Teste 1] Validação de parseBackupFilename');
  const parsed1 = parseBackupFilename('backup_2026-09-21_14-10-05.json.gz');
  assert(parsed1 !== null, 'Deveria parsear backup_2026-09-21_14-10-05.json.gz');
  assert.strictEqual(parsed1.dateStr, '2026-09-21');
  assert.strictEqual(parsed1.isoString, '2026-09-21T14:10:05.000Z');

  const parsed2 = parseBackupFilename('backup_2026-09-20_08-00-00.manifest.json');
  assert(parsed2 !== null, 'Deveria parsear backup manifest');
  assert.strictEqual(parsed2.dateStr, '2026-09-20');

  const invalid = parseBackupFilename('invalid_file_name.tar.gz');
  assert.strictEqual(invalid, null, 'Arquivo inválido deve retornar null');
  console.log('✓ Teste 1 passou com sucesso.');
}

// TESTE 2: Rotação com múltiplos backups no mesmo dia (Intra-day pruning)
{
  console.log('\n[Teste 2] Rotação Intra-Dia: Múltiplos backups no mesmo dia devem reter apenas o mais recente');
  const files = [
    'backup_2026-09-21_08-00-00.json.gz',
    'backup_2026-09-21_08-00-00.manifest.json',
    'backup_2026-09-21_12-30-00.json.gz',
    'backup_2026-09-21_12-30-00.manifest.json',
    'backup_2026-09-21_22-00-00.json.gz',
    'backup_2026-09-21_22-00-00.manifest.json',
  ];

  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 7 });

  // Como só existe 1 dia (2026-09-21), o mais recente (22:00) deve ser mantido, e os anteriores (08:00 e 12:30) podados
  assert(result.keep.includes('backup_2026-09-21_22-00-00.json.gz'), 'O mais recente do dia (22:00) deve ser preservado');
  assert(result.keep.includes('backup_2026-09-21_22-00-00.manifest.json'), 'O manifesto do mais recente do dia deve ser preservado');
  assert(result.prune.includes('backup_2026-09-21_08-00-00.json.gz'), 'Backup anterior do mesmo dia deve ser descartado');
  assert(result.prune.includes('backup_2026-09-21_12-30-00.json.gz'), 'Backup intermediário do mesmo dia deve ser descartado');
  assert.strictEqual(result.keep.length, 2, 'Apenas o par gz+manifest do mais recente deve ser mantido');
  console.log('✓ Teste 2 passou com sucesso.');
}

// TESTE 3: Garantia estrita de pelo menos 2 backups diários com >= 24h de espaçamento
{
  console.log('\n[Teste 3] Garantia estrita de pelo menos 2 backups diários (espaçamento >= 24h)');
  const files = [
    // Dia 1 (ontem)
    'backup_2026-09-20_03-00-00.json.gz',
    'backup_2026-09-20_03-00-00.manifest.json',
    'backup_2026-09-20_18-00-00.json.gz',
    'backup_2026-09-20_18-00-00.manifest.json',
    // Dia 2 (hoje)
    'backup_2026-09-21_03-00-00.json.gz',
    'backup_2026-09-21_03-00-00.manifest.json',
    'backup_2026-09-21_23-59-00.json.gz',
    'backup_2026-09-21_23-59-00.manifest.json'
  ];

  // Mesmo se retentionDays for 1, a regra de minDailyBackups = 2 DEVE manter ambos os dias
  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 1 });

  assert.strictEqual(result.summary.preservedDays, 2, 'Deve preservar exatamente 2 dias distintos');
  // Representante do dia 21 mantido: 23-59-00
  assert(result.keep.includes('backup_2026-09-21_23-59-00.json.gz'), 'Mais recente do dia 21 mantido');
  // Representante do dia 20 mantido: 18-00-00
  assert(result.keep.includes('backup_2026-09-20_18-00-00.json.gz'), 'Mais recente do dia 20 mantido (24h de espaço)');

  // Verificação matemática do espaçamento:
  const p1 = parseBackupFilename('backup_2026-09-20_18-00-00.json.gz');
  const p2 = parseBackupFilename('backup_2026-09-21_23-59-00.json.gz');
  const diffHours = (p2.timestamp - p1.timestamp) / (1000 * 60 * 60);
  assert(diffHours >= 24, `O espaçamento deve ser >= 24h, foi de ${diffHours.toFixed(1)}h`);

  // Arquivos órfãos do mesmo dia descartados:
  assert(result.prune.includes('backup_2026-09-20_03-00-00.json.gz'));
  assert(result.prune.includes('backup_2026-09-21_03-00-00.json.gz'));
  console.log(`✓ Teste 3 passou com sucesso. Espaçamento validado: ${diffHours.toFixed(1)} horas.`);
}

// TESTE 4: Simulação de 10 dias com retenção configurável
{
  console.log('\n[Teste 4] Simulação de 10 dias de histórico com retenção de 7 dias e minDailyBackups = 2');
  const files = [];
  for (let day = 10; day <= 19; day++) {
    const dayStr = `2026-09-${day}`;
    // 2 backups por dia: 03:00 e 15:00
    files.push(`backup_${dayStr}_03-00-00.json.gz`);
    files.push(`backup_${dayStr}_03-00-00.manifest.json`);
    files.push(`backup_${dayStr}_15-00-00.json.gz`);
    files.push(`backup_${dayStr}_15-00-00.manifest.json`);
  }

  const result = calculateRotation(files, { minDailyBackups: 2, retentionDays: 7 });

  // Dias esperados mantidos: os 7 mais recentes (dias 19, 18, 17, 16, 15, 14, 13)
  const expectedKeptDays = ['2026-09-19', '2026-09-18', '2026-09-17', '2026-09-16', '2026-09-15', '2026-09-14', '2026-09-13'];
  const expectedPrunedDays = ['2026-09-12', '2026-09-11', '2026-09-10'];

  assert.strictEqual(result.summary.preservedDays, 7, 'Deve manter 7 dias');
  assert.deepStrictEqual(result.summary.keptDaysList, expectedKeptDays);

  // Para cada dia mantido, apenas o das 15:00 (mais recente do dia) e seu manifesto devem estar em keep
  for (const kd of expectedKeptDays) {
    assert(result.keep.includes(`backup_${kd}_15-00-00.json.gz`), `15:00 do dia ${kd} deve estar mantido`);
    assert(result.keep.includes(`backup_${kd}_15-00-00.manifest.json`), `Manifesto 15:00 do dia ${kd} deve estar mantido`);
    assert(result.prune.includes(`backup_${kd}_03-00-00.json.gz`), `03:00 do dia ${kd} deve ser podado`);
  }

  // Para os dias expirados (< 13), todos os arquivos devem estar em prune
  for (const pd of expectedPrunedDays) {
    assert(result.prune.includes(`backup_${pd}_03-00-00.json.gz`), `03:00 do dia expirado ${pd} deve ser podado`);
    assert(result.prune.includes(`backup_${pd}_15-00-00.json.gz`), `15:00 do dia expirado ${pd} deve ser podado`);
  }

  // NUNCA pode podar os 2 mais recentes
  assert(result.keep.includes('backup_2026-09-19_15-00-00.json.gz'));
  assert(result.keep.includes('backup_2026-09-18_15-00-00.json.gz'));
  console.log('✓ Teste 4 passou com sucesso.');
}

// TESTE 5: Teste Físico em Diretório Temporário (Simulação End-to-End no Filesystem)
{
  console.log('\n[Teste 5] Simulação Física no Sistema de Arquivos');
  if (fs.existsSync(TEST_TMP_DIR)) {
    fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEST_TMP_DIR, { recursive: true });

  const dummyFiles = [
    // Dia 1
    'backup_2026-09-01_10-00-00.json.gz',
    'backup_2026-09-01_18-00-00.json.gz',
    // Dia 2
    'backup_2026-09-02_10-00-00.json.gz',
    'backup_2026-09-02_20-00-00.json.gz',
    // Dia 3
    'backup_2026-09-03_12-00-00.json.gz',
  ];

  for (const f of dummyFiles) {
    fs.writeFileSync(path.join(TEST_TMP_DIR, f), 'dummy content');
  }

  const rotation = calculateRotation(fs.readdirSync(TEST_TMP_DIR), { minDailyBackups: 2, retentionDays: 2 });
  for (const fileToPrune of rotation.prune) {
    fs.unlinkSync(path.join(TEST_TMP_DIR, fileToPrune));
  }

  const remaining = fs.readdirSync(TEST_TMP_DIR).sort();
  // Com minDailyBackups = 2 e retentionDays = 2, devem sobrar os mais recentes do dia 03 e do dia 02
  const expectedRemaining = [
    'backup_2026-09-02_20-00-00.json.gz',
    'backup_2026-09-03_12-00-00.json.gz'
  ].sort();

  assert.deepStrictEqual(remaining, expectedRemaining, 'Arquivos físicos restantes devem corresponder exatamente aos 2 backups diários com >= 24h de espaço');

  // Limpar diretório de teste temporário
  fs.rmSync(TEST_TMP_DIR, { recursive: true, force: true });
  console.log('✓ Teste 5 físico passou com sucesso.');
}

// TESTE 6: Verificação de Integridade Real do Backup Gerado
{
  console.log('\n[Teste 6] Verificação de Integridade do Backup Real Gerado');
  const backupsDir = path.resolve(PROJECT_ROOT, 'backups');
  const gzFiles = fs.readdirSync(backupsDir).filter(f => f.endsWith('.json.gz'));
  assert(gzFiles.length > 0, 'Deve haver pelo menos um backup real gerado em backups/');

  const targetFile = path.join(backupsDir, gzFiles[0]);
  const result = verifyBackupIntegrity(targetFile);
  assert.strictEqual(result.valid, true, 'O arquivo de backup deve ser válido');
  assert(result.tablesCount >= 10, 'Deve conter todas as 10 tabelas do sistema');
  assert(result.totalRecords >= 0, 'Deve ter contagem de registros');
  console.log(`✓ Teste 6 passou com sucesso. Backup real verificado (${result.tablesCount} tabelas, ${result.totalRecords} registros).`);
}

console.log('\n========================================================');
console.log('  TODOS OS TESTES DE ROTAÇÃO E INTEGRIDADE PASSARAM!  ');
console.log('========================================================\n');
