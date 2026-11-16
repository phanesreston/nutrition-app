import { describe, expect, it } from "vitest";
import { expandUpcE, gtinCheckDigit, hasValidCheckDigit, parseBarcode } from "./barcode";

describe("check digits", () => {
  it("computes the GS1 mod-10 digit", () => {
    expect(gtinCheckDigit("301762042200")).toBe(3); // Nutella 3017620422003
    expect(gtinCheckDigit("5018445")).toBe(3); // Marmite 50184453
    expect(gtinCheckDigit("01600027528")).toBe(7); // Cheerios 016000275287
  });

  it("rejects wrong digits and non-numeric input", () => {
    expect(hasValidCheckDigit("3017620422003")).toBe(true);
    expect(hasValidCheckDigit("3017620422004")).toBe(false);
    expect(hasValidCheckDigit("30176204220a3")).toBe(false);
  });
});

describe("parseBarcode", () => {
  it("accepts EAN-13, EAN-8 and UPC-A", () => {
    expect(parseBarcode("3017620422003")).toEqual({ code: "3017620422003", kind: "EAN-13" });
    expect(parseBarcode("50184453")).toEqual({ code: "50184453", kind: "EAN-8" });
    expect(parseBarcode("016000275287")).toEqual({ code: "0016000275287", kind: "UPC-A" });
  });

  it("gives UPC-A the same canonical form whether typed with 12 or 13 digits", () => {
    expect(parseBarcode("0016000275287")?.code).toBe(parseBarcode("016000275287")?.code);
  });

  it("ignores spaces and hyphens", () => {
    expect(parseBarcode(" 3 017620-422003 ")?.code).toBe("3017620422003");
  });

  it("rejects typos, wrong lengths and junk", () => {
    expect(parseBarcode("3017620422004")).toBeNull();
    expect(parseBarcode("12345")).toBeNull();
    expect(parseBarcode("")).toBeNull();
    expect(parseBarcode("not a barcode")).toBeNull();
    expect(parseBarcode("30176204220031234")).toBeNull();
  });

  it("expands UPC-E when the scanner reports that format", () => {
    expect(parseBarcode("01234565", { format: "upc_e" })).toEqual({ code: "0012345000065", kind: "UPC-A" });
  });
});

describe("expandUpcE", () => {
  it("handles each expansion rule", () => {
    expect(expandUpcE("01234565")).toBe("012345000065"); // last digit 5–9
    expect(expandUpcE("04252614")).toBe("042100005264"); // last digit 1
    expect(expandUpcE("0123456x")).toBeNull();
    expect(expandUpcE("21234565")).toBeNull(); // number system must be 0 or 1
  });
});
