import { Locale } from "@/lib/i18n/translations";

export interface CurrencyConfig {
  code: string;
  name: string;
  nameAr: string;
  nameFr: string;
  symbol: string;
  rateToUSD: number; // Base rate relative to 1 USD
  decimals: number;
}

export const SUPPORTED_CURRENCIES: Record<string, CurrencyConfig> = {
  FCFA: {
    code: "FCFA",
    name: "CFA Franc",
    nameAr: "فرنك سيفا (FCFA)",
    nameFr: "Franc CFA",
    symbol: "FCFA",
    rateToUSD: 605.5,
    decimals: 0,
  },
  EUR: {
    code: "EUR",
    name: "Euro",
    nameAr: "يورو (€)",
    nameFr: "Euro",
    symbol: "€",
    rateToUSD: 0.92,
    decimals: 2,
  },
  USD: {
    code: "USD",
    name: "US Dollar",
    nameAr: "دولار أمريكي ($)",
    nameFr: "Dollar US",
    symbol: "$",
    rateToUSD: 1.0,
    decimals: 2,
  },
  SAR: {
    code: "SAR",
    name: "Saudi Riyal",
    nameAr: "ريال سعودي (ر.س)",
    nameFr: "Riyal Saoudien",
    symbol: "ر.س",
    rateToUSD: 3.75,
    decimals: 2,
  },
  AED: {
    code: "AED",
    name: "UAE Dirham",
    nameAr: "درهم إماراتي (د.إ)",
    nameFr: "Dirham Émirati",
    symbol: "د.إ",
    rateToUSD: 3.67,
    decimals: 2,
  },
  NGN: {
    code: "NGN",
    name: "Nigerian Naira",
    nameAr: "نايرا نيجيرية (₦)",
    nameFr: "Naira Nigérian",
    symbol: "₦",
    rateToUSD: 1480.0,
    decimals: 2,
  },
  GBP: {
    code: "GBP",
    name: "British Pound",
    nameAr: "جنيه إسترليني (£)",
    nameFr: "Livre Sterling",
    symbol: "£",
    rateToUSD: 0.78,
    decimals: 2,
  },
  CNY: {
    code: "CNY",
    name: "Chinese Yuan",
    nameAr: "يوان صيني (¥)",
    nameFr: "Yuan Chinois",
    symbol: "¥",
    rateToUSD: 7.23,
    decimals: 2,
  },
};

/**
 * Converts any monetary amount between two currencies using reference rates
 */
export function convertCurrency(
  amount: number,
  fromCode: string,
  toCode: string,
  customRates?: Record<string, number>
): number {
  if (!amount || fromCode === toCode) return amount || 0;

  const fromRate = customRates?.[fromCode] || SUPPORTED_CURRENCIES[fromCode]?.rateToUSD || 1.0;
  const toRate = customRates?.[toCode] || SUPPORTED_CURRENCIES[toCode]?.rateToUSD || 1.0;

  // Convert to USD first, then to target currency
  const amountInUSD = amount / fromRate;
  const targetAmount = amountInUSD * toRate;

  const targetDecimals = SUPPORTED_CURRENCIES[toCode]?.decimals ?? 2;
  return Number(targetAmount.toFixed(targetDecimals));
}

/**
 * Formats a currency amount elegantly according to locale and currency standard
 */
export function formatCurrencyAmount(
  amount: number | null | undefined,
  currencyCode: string = "FCFA",
  locale: Locale = "fr"
): string {
  const safeAmount = amount ?? 0;
  const curr = SUPPORTED_CURRENCIES[currencyCode] || { symbol: currencyCode, decimals: 2 };

  try {
    const localeString = locale === "ar" ? "ar-SA" : locale === "en" ? "en-US" : "fr-FR";
    
    // Custom handling for FCFA which looks cleanest with space grouping
    if (currencyCode === "FCFA" || currencyCode === "XOF" || currencyCode === "XAF") {
      const formattedNumber = new Intl.NumberFormat(localeString, {
        maximumFractionDigits: 0,
        minimumFractionDigits: 0,
      }).format(Math.round(safeAmount));
      return locale === "ar" ? `${formattedNumber} فرنك سيفا` : `${formattedNumber} FCFA`;
    }

    return new Intl.NumberFormat(localeString, {
      maximumFractionDigits: curr.decimals,
      minimumFractionDigits: curr.decimals,
    }).format(safeAmount) + ` ${curr.symbol}`;
  } catch (e) {
    return `${safeAmount.toLocaleString()} ${currencyCode}`;
  }
}
