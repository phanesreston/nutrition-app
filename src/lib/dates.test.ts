import { describe, expect, it } from "vitest";
import { isIsoDay, shiftDay, formatDay, resolveDay } from "./dates";

describe("dates", () => {
  it("validates ISO days", () => {
    expect(isIsoDay("2026-02-28")).toBe(true);
    expect(isIsoDay("2026-02-30")).toBe(false);
    expect(isIsoDay("2026-2-3")).toBe(false);
    expect(isIsoDay(undefined)).toBe(false);
  });
  it("shifts across month and year boundaries", () => {
    expect(shiftDay("2026-03-01", -1)).toBe("2026-02-28");
    expect(shiftDay("2026-12-31", 1)).toBe("2027-01-01");
  });
  it("formats relative days", () => {
    expect(formatDay("2026-11-16", "2026-11-16")).toBe("Today");
    expect(formatDay("2026-11-15", "2026-11-16")).toBe("Yesterday");
    expect(formatDay("2026-11-02", "2026-11-16")).toBe("Mon 2 Nov");
  });
  it("falls back to today for bad params", () => {
    expect(isIsoDay(resolveDay("nonsense"))).toBe(true);
    expect(resolveDay("2026-01-05")).toBe("2026-01-05");
  });
});
