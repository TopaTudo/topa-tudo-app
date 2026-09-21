/**
 * Utilitários de Data e Hora com proteção contra Timezone Drift (PT-BR)
 */

/**
 * Retorna uma string no formato YYYY-MM-DD no horário local da máquina/dispositivo.
 * Previne o problema de UTC drift onde entre 21h00 e 23h59 no Brasil (UTC-3)
 * métodos como .toISOString().substring(0, 10) avançam indevidamente para o dia seguinte.
 */
export function getLocalDateString(d?: Date | string | null): string {
  if (!d) {
    const now = new Date();
    return formatLocalDateParts(now);
  }

  if (typeof d === 'string') {
    // Se já for apenas YYYY-MM-DD puro, retorna sem reinterpretar
    if (/^\d{4}-\d{2}-\d{2}$/.test(d.trim())) {
      return d.trim();
    }
    const parsed = new Date(d);
    if (isNaN(parsed.getTime())) return '';
    return formatLocalDateParts(parsed);
  }

  if (isNaN(d.getTime())) return '';
  return formatLocalDateParts(d);
}

function formatLocalDateParts(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

/**
 * Formata um timestamp ISO ou data para exibição local no formato brasileiro:
 * DD/MM/YYYY HH:mm ou DD/MM/YYYY.
 */
export function formatLocalDateTime(isoString?: string | null): string {
  if (!isoString) return '';
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return '';

  const day = String(date.getDate()).padStart(2, '0');
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const year = date.getFullYear();
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');

  return `${day}/${month}/${year} ${hours}:${minutes}`;
}

/**
 * Extrai a hora local de uma data/timestamp no formato HH:mm
 */
export function getLocalTimeString(d?: Date | string | null): string {
  if (!d) return '08:00';
  const date = typeof d === 'string' ? new Date(d) : d;
  if (isNaN(date.getTime())) return '08:00';
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${hours}:${minutes}`;
}

/**
 * Combina uma data (YYYY-MM-DD) e um horário (HH:mm) selecionados pelo usuário,
 * gerando um ISO 8601 que preserva o momento no fuso horário local do dispositivo.
 */
export function createLocalISOString(dateStr: string, timeStr?: string): string {
  if (!dateStr) return '';
  const cleanDate = dateStr.trim();
  const [yearStr, monthStr, dayStr] = cleanDate.split('-');
  const year = parseInt(yearStr, 10);
  const month = parseInt(monthStr, 10) - 1;
  const day = parseInt(dayStr, 10);

  let hours = 0;
  let minutes = 0;
  if (timeStr && timeStr.includes(':')) {
    const [h, m] = timeStr.trim().split(':');
    hours = parseInt(h, 10) || 0;
    minutes = parseInt(m, 10) || 0;
  }

  const localDate = new Date(year, month, day, hours, minutes, 0, 0);
  return localDate.toISOString();
}
