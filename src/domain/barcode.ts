/**
 * Retail barcode (GTIN) handling: validation, check digits and a canonical
 * form so the same product is found however it was scanned or typed.
 */

export type BarcodeKind = "EAN-8" | "UPC-A" | "EAN-13" | "GTIN-14";

export interface ParsedBarcode {
  /** Canonical form: EAN-8 stays 8 digits; UPC-A is zero-padded to 13; EAN-13 and GTIN-14 unchanged. */
  code: string;
  kind: BarcodeKind;
}

/** GS1 mod-10 check digit for the digits that precede it. */
export function gtinCheckDigit(body: string): number {
  let sum = 0;
  // Weights alternate 3,1,3,1… starting from the rightmost body digit.
  for (let i = body.length - 1, weight = 3; i >= 0; i--, weight = 4 - weight) {
    sum += Number(body[i]) * weight;
  }
  return (10 - (sum % 10)) % 10;
}

export function hasValidCheckDigit(code: string): boolean {
  return /^\d+$/.test(code) && gtinCheckDigit(code.slice(0, -1)) === Number(code.at(-1));
}

/**
 * Expand an 8-digit UPC-E code (number system, 6 digits, check digit) to
 * its 12-digit UPC-A equivalent. Returns null if it is not valid UPC-E.
 */
export function expandUpcE(upcE: string): string | null {
  if (!/^[01]\d{7}$/.test(upcE)) return null;
  const system = upcE[0];
  const [d1, d2, d3, d4, d5, d6] = upcE.slice(1, 7);
  const check = upcE[7];
  let body: string;
  if (d6 === "0" || d6 === "1" || d6 === "2") body = `${d1}${d2}${d6}0000${d3}${d4}${d5}`;
  else if (d6 === "3") body = `${d1}${d2}${d3}00000${d4}${d5}`;
  else if (d6 === "4") body = `${d1}${d2}${d3}${d4}00000${d5}`;
  else body = `${d1}${d2}${d3}${d4}${d5}0000${d6}`;
  const upcA = `${system}${body}${check}`;
  return hasValidCheckDigit(upcA) ? upcA : null;
}

/**
 * Parse user or scanner input into a canonical barcode. Spaces and hyphens
 * are ignored. Returns null for anything that is not a GTIN with a correct
 * check digit — which also catches most typos and misreads.
 *
 * Pass `format: "upc_e"` when a scanner reports that symbology; an 8-digit
 * code is otherwise treated as EAN-8.
 */
export function parseBarcode(input: string, options: { format?: string } = {}): ParsedBarcode | null {
  let digits = input.replace(/[\s-]/g, "");
  if (!/^\d+$/.test(digits)) return null;

  if (options.format === "upc_e" && digits.length === 8) {
    const expanded = expandUpcE(digits);
    if (!expanded) return null;
    digits = expanded;
  }

  if (!hasValidCheckDigit(digits)) return null;
  switch (digits.length) {
    case 8:
      return { code: digits, kind: "EAN-8" };
    case 12:
      return { code: `0${digits}`, kind: "UPC-A" };
    case 13:
      return { code: digits, kind: digits.startsWith("0") ? "UPC-A" : "EAN-13" };
    case 14:
      return { code: digits, kind: "GTIN-14" };
    default:
      return null;
  }
}
