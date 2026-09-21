/**
 * Utilitários de Conversão e Formatação de Moeda e Números no padrão BRL (Brasil)
 */

/**
 * Converte com segurança entradas numéricas ou strings no padrão brasileiro (com vírgula)
 * ou internacional (com ponto) para número JavaScript (float).
 * Exemplos:
 *  - "150,50" -> 150.5
 *  - "1.250,75" -> 1250.75
 *  - "250.00" -> 250
 *  - 120 -> 120
 *  - null/undefined/"" -> 0
 */
export function parseBRLNumber(val: string | number | null | undefined): number {
  if (val === null || val === undefined) return 0;
  if (typeof val === 'number') {
    return isNaN(val) ? 0 : val;
  }

  const str = String(val).trim();
  if (!str) return 0;

  // Remover R$, espaços e caracteres não numéricos exceto vírgula, ponto e sinal de menos
  let cleaned = str.replace(/[^\d.,\-]/g, '');

  if (!cleaned) return 0;

  const hasComma = cleaned.includes(',');
  const hasDot = cleaned.includes('.');

  if (hasComma && hasDot) {
    // Ex: "1.250,50" ou "1,250.50"
    const lastComma = cleaned.lastIndexOf(',');
    const lastDot = cleaned.lastIndexOf('.');
    if (lastComma > lastDot) {
      // Padrão brasileiro: ponto é milhar, vírgula é decimal
      cleaned = cleaned.replace(/\./g, '').replace(',', '.');
    } else {
      // Padrão americano: vírgula é milhar, ponto é decimal
      cleaned = cleaned.replace(/,/g, '');
    }
  } else if (hasComma) {
    // Ex: "150,50" -> "150.50"
    cleaned = cleaned.replace(',', '.');
  }

  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? 0 : parsed;
}

/**
 * Formata um valor numérico no padrão de moeda Real Brasileiro (R$ 1.250,50).
 */
export function formatBRL(val: number | null | undefined): string {
  if (val === null || val === undefined || isNaN(val)) {
    return 'R$ 0,00';
  }

  return new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(val);
}
