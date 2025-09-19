export function toCents(value: number): number {
  return Math.round(Number(value || 0) * 100);
}

export function fromCents(cents: number): number {
  return Math.round(Number(cents || 0)) / 100;
}

export function formatCurrency(value: number, currency: string = 'USD', locale: string = 'en-US'): string {
  const n = Number.isFinite(value) ? value : 0;
  return new Intl.NumberFormat(locale, { style: 'currency', currency, minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n);
}


