/**
 * Utilitários de Segurança e Sanitização
 */

/**
 * Sanitiza uma célula de arquivo CSV contra vulnerabilidades de Formula Injection (CWE-1236).
 * Se o valor iniciar com '=', '+', '-', '@' ou caracteres de controle, adiciona um apóstrofo
 * (') antes do conteúdo e envolve em aspas duplas, com escape de aspas internas (" -> "").
 */
export function sanitizeCsvCell(val: any): string {
  if (val === null || val === undefined) {
    return '""';
  }

  let str = String(val);

  // Verifica se o texto inicia com operadores de fórmula em planilhas
  if (/^[=+\-@\t\r]/.test(str)) {
    str = `'${str}`;
  }

  // Escapar aspas duplas para o formato RFC 4180 de CSV
  const escaped = str.replace(/"/g, '""');
  return `"${escaped}"`;
}
