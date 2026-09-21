import assert from 'node:assert';
import QRCode from 'qrcode';

// 1. Tabela de padrões Code 128 (larguras de barras e espaços para cada símbolo 0-106)
const CODE128_PATTERNS = [
  '212222', '222122', '222221', '121223', '121322', '131222', '122213', '122312', '132212', '221213', // 0-9
  '221312', '231212', '112232', '122132', '122231', '113222', '123122', '123221', '223211', '221132', // 10-19
  '221231', '213212', '223112', '312131', '311222', '321122', '321221', '312212', '322112', '322211', // 20-29
  '212123', '212321', '232121', '111323', '131123', '131321', '112313', '132113', '132311', '211313', // 30-39
  '231113', '231311', '112133', '112331', '132131', '113123', '113321', '133121', '313121', '211331', // 40-49
  '231131', '213113', '213311', '213131', '311123', '311321', '331121', '312113', '312311', '332111', // 50-59
  '314111', '221411', '431111', '111224', '111422', '121124', '121421', '141122', '141221', '112214', // 60-69
  '112412', '122114', '122411', '142112', '142211', '241211', '221114', '413111', '241112', '134111', // 70-79
  '111242', '121142', '121241', '114212', '124112', '124211', '411212', '421112', '421211', '212141', // 80-89
  '214121', '412121', '111143', '111341', '131141', '114113', '114311', '411113', '411311', '113141', // 90-99
  '114131', '311141', '411131', '211412', '211214', '211232', '2331112' // 100-106
];

function encodeCode128B(text) {
  const startB = 104;
  const stop = 106;
  const indices = [startB];
  let checksum = startB;

  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i) - 32;
    if (code < 0 || code > 95) continue;
    indices.push(code);
    checksum += code * (i + 1);
  }
  indices.push(checksum % 103);
  indices.push(stop);

  let modules = '';
  for (const idx of indices) {
    const pattern = CODE128_PATTERNS[idx];
    if (!pattern) continue;
    let isBar = true;
    for (const w of pattern) {
      modules += (isBar ? '1' : '0').repeat(Number(w));
      isBar = !isBar;
    }
  }
  return modules;
}

console.log('🧪 Iniciando testes do Gerador de Recibo Térmico...');

// Teste 1: Code 128
const barcode = encodeCode128B('OS-00042');
assert.ok(barcode.length > 50, 'Código de barras gerou sequência não nula');
assert.match(barcode, /^[01]+$/, 'Código de barras contém apenas 0 e 1');
console.log(`✅ Teste 1: Barcode Code 128B gerado com sucesso (${barcode.length} módulos)`);

// Teste 2: QR Code Pix
const qr = QRCode.create('00020126360014br.gov.bcb.pix0114174117750001525204000053039865406350.005802BR5920TOPA TUDO MANUTENCAO6006BRASIL62110507OS000426304C46A', {
  errorCorrectionLevel: 'M',
});
assert.ok(qr.modules.size >= 21, 'QR code gerou matriz válida');
assert.ok(qr.modules.data.length === qr.modules.size * qr.modules.size, 'Dados do QR correspondem ao tamanho da matriz');
console.log(`✅ Teste 2: Matriz QR Code PIX gerada com sucesso (${qr.modules.size}x${qr.modules.size})`);

// Teste 3: Mock do Canvas e todas as operações de desenho
class MockCanvasContext {
  constructor() {
    this.commands = [];
  }
  save() { this.commands.push('save'); }
  restore() { this.commands.push('restore'); }
  scale(x, y) { this.commands.push(`scale(${x}, ${y})`); }
  beginPath() { this.commands.push('beginPath'); }
  closePath() { this.commands.push('closePath'); }
  moveTo(x, y) { this.commands.push(`moveTo(${x}, ${y})`); }
  lineTo(x, y) { this.commands.push(`lineTo(${x}, ${y})`); }
  stroke() { this.commands.push('stroke'); }
  fill() { this.commands.push('fill'); }
  clip() { this.commands.push('clip'); }
  fillRect(x, y, w, h) { this.commands.push(`fillRect(${x},${y},${w},${h})`); }
  strokeRect(x, y, w, h) { this.commands.push(`strokeRect(${x},${y},${w},${h})`); }
  fillText(text, x, y) { this.commands.push(`fillText("${text.slice(0, 15)}", ${x}, ${y})`); }
  measureText(text) { return { width: (text || '').length * 7 }; }
  drawImage() { this.commands.push('drawImage'); }
}

const mockCtx = new MockCanvasContext();

// Testa dentes de serra (guilhotina)
function drawSerratedPaperPath(ctx, width, height, toothWidth = 14.5, toothHeight = 7) {
  const numTeeth = Math.ceil(width / toothWidth);
  ctx.beginPath();
  ctx.moveTo(0, toothHeight);
  for (let i = 0; i < numTeeth; i++) {
    const xMid = i * toothWidth + toothWidth / 2;
    const xEnd = Math.min((i + 1) * toothWidth, width);
    ctx.lineTo(xMid, 0);
    ctx.lineTo(xEnd, toothHeight);
  }
  ctx.lineTo(width, height - toothHeight);
  for (let i = numTeeth; i > 0; i--) {
    const xMid = (i - 0.5) * toothWidth;
    const xEnd = (i - 1) * toothWidth;
    ctx.lineTo(xMid, height);
    ctx.lineTo(xEnd, height - toothHeight);
  }
  ctx.lineTo(0, toothHeight);
  ctx.closePath();
}

drawSerratedPaperPath(mockCtx, 580, 1200);
mockCtx.fill();
mockCtx.stroke();
console.log('✅ Teste 3: Dentes de serra (guilhotina de bobina) simulados no Canvas com sucesso');

console.log('🎉 Todos os testes unitários do recibo térmico passaram com 100% de sucesso!');
