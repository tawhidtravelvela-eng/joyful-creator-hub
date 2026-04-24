/**
 * Detects currency/price patterns in blog HTML content and converts them
 * to the user's selected display currency with smart rounding.
 */

import type { CurrencyCode } from "@/contexts/CurrencyContext";

const SYMBOL_TO_CODE: Record<string, string> = {
  "$": "USD",
  "€": "EUR",
  "£": "GBP",
  "৳": "BDT",
  "¥": "CNY",
  "₹": "INR",
};

const CODE_SYMBOLS: Record<string, string> = {
  USD: "$", EUR: "€", GBP: "£", BDT: "৳", CNY: "¥", INR: "₹",
};

// Match patterns like $100, €1,500, £20.50, USD 300, BDT 5000, 200 USD etc.
const PRICE_RE = /(?:(\$|€|£|৳|¥|₹)\s?([\d,]+(?:\.\d{1,2})?))|(?:(USD|EUR|GBP|BDT|CNY|INR)\s?([\d,]+(?:\.\d{1,2})?))|(?:([\d,]+(?:\.\d{1,2})?)\s?(USD|EUR|GBP|BDT|CNY|INR))/gi;

/** Smart rounding: <100→nearest 1, <1000→nearest 5, <10k→nearest 10, else nearest 50 */
const smartRound = (n: number): number => {
  if (n < 100) return Math.round(n);
  if (n < 1000) return Math.round(n / 5) * 5;
  if (n < 10000) return Math.round(n / 10) * 10;
  return Math.round(n / 50) * 50;
};

export const convertBlogPrices = (
  html: string,
  targetCurrency: CurrencyCode,
  liveRates: Record<string, number>,
): string => {
  return html.replace(PRICE_RE, (match, sym, symAmt, codePre, codePreAmt, codePostAmt, codePost) => {
    let sourceCurr: string;
    let rawAmount: string;

    if (sym) {
      sourceCurr = SYMBOL_TO_CODE[sym] || "USD";
      rawAmount = symAmt;
    } else if (codePre) {
      sourceCurr = codePre.toUpperCase();
      rawAmount = codePreAmt;
    } else {
      sourceCurr = codePost.toUpperCase();
      rawAmount = codePostAmt;
    }

    const amount = parseFloat(rawAmount.replace(/,/g, ""));
    if (isNaN(amount) || amount <= 0) return match;

    // If source is already target, just re-format nicely
    if (sourceCurr === targetCurrency) {
      const rounded = smartRound(amount);
      const symbol = CODE_SYMBOLS[targetCurrency] || targetCurrency + " ";
      return `${symbol}${rounded.toLocaleString()}`;
    }

    const srcRate = liveRates[sourceCurr] || 1;
    const dstRate = liveRates[targetCurrency] || 1;
    const converted = (amount / srcRate) * dstRate;
    const rounded = smartRound(converted);

    const symbol = CODE_SYMBOLS[targetCurrency] || targetCurrency + " ";
    return `<span title="Originally ${match.trim()}">${symbol}${rounded.toLocaleString()}</span>`;
  });
};
