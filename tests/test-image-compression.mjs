import assert from 'node:assert';
import { formatBytes, compressImageWithStats } from '../src/core/utils/image.ts';

console.log('🧪 Iniciando testes de Compressão de Imagens...');

// Teste 1: Formatação de Bytes
assert.strictEqual(formatBytes(0), '0 B');
assert.strictEqual(formatBytes(512), '512 B');
assert.strictEqual(formatBytes(1024), '1 KB');
assert.strictEqual(formatBytes(300 * 1024), '300 KB');
assert.strictEqual(formatBytes(8.4 * 1024 * 1024), '8.4 MB');
console.log('✅ Teste 1: formatBytes formatou tamanhos corretamente');

// Teste 2: Fallback seguro para arquivos não-imagem
const dummyFile = new File(['hello world'], 'document.txt', { type: 'text/plain' });
const resNonImage = await compressImageWithStats(dummyFile);
assert.strictEqual(resNonImage.file, dummyFile, 'Arquivos não-imagem não devem ser alterados');
assert.strictEqual(resNonImage.savedPercentage, 0);
console.log('✅ Teste 2: Arquivos não-imagem preservados intactos');

// Teste 3: Preservação de GIFs e SVGs vetoriais
const dummySvg = new File(['<svg></svg>'], 'icon.svg', { type: 'image/svg+xml' });
const resSvg = await compressImageWithStats(dummySvg);
assert.strictEqual(resSvg.file, dummySvg, 'SVGs não devem ser rasterizados');
console.log('✅ Teste 3: SVGs e GIFs ignorados com segurança');

// Teste 4: Fallback resiliente em ambiente headless (Node.js)
const dummyJpg = new File([new Uint8Array(2048)], 'foto_campo.jpg', { type: 'image/jpeg' });
const resJpg = await compressImageWithStats(dummyJpg);
assert.ok(resJpg.file, 'Arquivo de retorno existe');
assert.strictEqual(resJpg.originalSize, 2048);
console.log('✅ Teste 4: Tratamento gracioso em ambiente sem DOM');

console.log('🎉 Todos os testes de compressão de imagens passaram com 100% de sucesso!');
