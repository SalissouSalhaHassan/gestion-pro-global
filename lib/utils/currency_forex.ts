export interface CurrencyRate {
  code: string;
  nom: string;
  symbole: string;
  taux_vers_cfa: number; // 1 unit of this currency = X FCFA
  is_base: boolean;
}

export const DEFAULT_RATES: CurrencyRate[] = [
  { code: 'FCFA', nom: 'Franc CFA', symbole: 'FCFA', taux_vers_cfa: 1.0, is_base: true },
  { code: 'NGN', nom: 'Naira Nigérian', symbole: '₦', taux_vers_cfa: 0.40, is_base: false },
  { code: 'USD', nom: 'Dollar Américain', symbole: '$', taux_vers_cfa: 615.0, is_base: false },
  { code: 'EUR', nom: 'Euro', symbole: '€', taux_vers_cfa: 655.957, is_base: false },
];

/**
 * Converts an amount from FCFA to a target foreign currency
 */
export function convertFromCFA(amountInCFA: number, targetCode: string, rates: CurrencyRate[] = DEFAULT_RATES): number {
  if (targetCode === 'FCFA') return amountInCFA;
  const target = rates.find((r) => r.code === targetCode);
  if (!target || target.taux_vers_cfa <= 0) return amountInCFA;
  return amountInCFA / target.taux_vers_cfa;
}

/**
 * Converts an amount from a foreign currency to FCFA
 */
export function convertToCFA(amountForeign: number, sourceCode: string, rates: CurrencyRate[] = DEFAULT_RATES): number {
  if (sourceCode === 'FCFA') return amountForeign;
  const source = rates.find((r) => r.code === sourceCode);
  if (!source) return amountForeign;
  return amountForeign * source.taux_vers_cfa;
}

/**
 * Returns formatted dual-currency string: e.g. "50,000 FCFA ≈ ₦125,000"
 */
export function formatDualCurrency(amountInCFA: number, secondaryCode: string = 'NGN', rates: CurrencyRate[] = DEFAULT_RATES): string {
  const cfaFormatted = `${Math.round(amountInCFA).toLocaleString()} FCFA`;
  if (secondaryCode === 'FCFA') return cfaFormatted;

  const target = rates.find((r) => r.code === secondaryCode);
  if (!target) return cfaFormatted;

  const converted = convertFromCFA(amountInCFA, secondaryCode, rates);
  return `${cfaFormatted} ≈ ${target.symbole}${Math.round(converted).toLocaleString()}`;
}
