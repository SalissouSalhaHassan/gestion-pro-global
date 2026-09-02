import { NextResponse } from 'next/server';
import { SUPPORTED_CURRENCIES } from '@/lib/utils/currency';

export async function GET() {
  try {
    // Return standard updated rates map
    const rates: Record<string, number> = {};
    Object.keys(SUPPORTED_CURRENCIES).forEach((code) => {
      rates[code] = SUPPORTED_CURRENCIES[code].rateToUSD;
    });

    return NextResponse.json({
      success: true,
      base: 'USD',
      updated_at: new Date().toISOString(),
      currencies: SUPPORTED_CURRENCIES,
      rates,
    });
  } catch (error: any) {
    return NextResponse.json(
      { error: 'Failed to fetch currency rates' },
      { status: 500 }
    );
  }
}
