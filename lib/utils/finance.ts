/**
 * Financial utilities for handling precision issues with floating point numbers.
 */

const PRECISION = 0.01;

/**
 * Rounds a number to 2 decimal places.
 */
export function round(amount: number): number {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

/**
 * Compares two amounts with a small precision tolerance.
 * Returns true if a >= b
 */
export function isGreaterOrEqual(a: number, b: number): boolean {
  return (a + PRECISION) >= b;
}

/**
 * Compares two amounts with a small precision tolerance.
 * Returns true if a == b
 */
export function isAlmostEqual(a: number, b: number): boolean {
  return Math.abs(a - b) < PRECISION;
}

/**
 * Formats an amount as FCFA.
 */
export function formatFCFA(amount: number): string {
  return new Intl.NumberFormat("fr-FR", {
    style: "currency",
    currency: "XOF",
    minimumFractionDigits: 0,
  }).format(amount);
}
