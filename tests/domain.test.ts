import { describe, expect, it } from "vitest";
import { TODAY, TODAY_LABEL, daysBetween, last30DaysStartDate, previousMonthRange } from "@/lib/clock";
import { normalizeEmail } from "@/lib/email";
import { normalizeSource } from "@/lib/sources";

describe("email normalization", () => {
  it("normalizes case, whitespace, and Unicode compatibility characters", () => {
    expect(normalizeEmail("  Ａlice@Example.COM  ")).toBe("alice@example.com");
  });
  it("preserves plus tags and dots", () => {
    expect(normalizeEmail("A.lice+news@gmail.com")).toBe("a.lice+news@gmail.com");
  });
  it("returns null for malformed addresses", () => {
    expect(normalizeEmail("not-an-email")).toBeNull();
    expect(normalizeEmail("@gmail.com")).toBeNull();
    expect(normalizeEmail(null)).toBeNull();
  });
});

describe("source mapping", () => {
  it("maps canonical names case-insensitively and twitter to X", () => {
    expect(normalizeSource("instagram")).toBe("Instagram");
    expect(normalizeSource("twitter")).toBe("X");
    expect(normalizeSource(" ")).toBeNull();
    expect(normalizeSource("unknown")).toBeNull();
  });
});

describe("product clock", () => {
  it("uses the assessment date", () => {
    expect(TODAY).toBe("2026-09-28");
    expect(TODAY_LABEL).toBe("Monday, September 28, 2026");
    expect(daysBetween("2026-08-29")).toBe(30);
    expect(last30DaysStartDate()).toBe("2026-08-29");
    expect(previousMonthRange()).toEqual(["2026-08-01", "2026-08-31"]);
  });
});
