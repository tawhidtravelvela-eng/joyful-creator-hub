import { describe, it, expect } from "vitest";
import {
  calcRooms,
  getExactFareTotal,
  buildExactFare,
  getFlightFareBreakdown,
  calcFlightCost,
  calcHotelCost,
  calcActivityCost,
  formatTravelerBreakdown,
  getAirlineInfo,
  formatAirlineDisplay,
  computeFlightDuration,
  prefixFlightNumber,
  formatFlightTime,
  resolveCity,
  cleanInsightReason,
  normalizeHotelText,
} from "../tripPricingUtils";

describe("calcRooms", () => {
  it("returns 1 for solo traveler", () => expect(calcRooms(1, 0)).toBe(1));
  it("returns 1 for 2 adults", () => expect(calcRooms(2, 0)).toBe(1));
  it("returns 2 for 3 adults", () => expect(calcRooms(3, 0)).toBe(2));
  it("accounts for children sharing beds", () => expect(calcRooms(2, 2)).toBe(2));
});

describe("getExactFareTotal", () => {
  it("returns null for no fare", () => expect(getExactFareTotal(null)).toBeNull());
  it("uses total field", () => expect(getExactFareTotal({ total: 150.7 })).toBe(151));
  it("uses totalFare fallback", () => expect(getExactFareTotal({ totalFare: 200 })).toBe(200));
  it("sums base + taxes", () => expect(getExactFareTotal({ base: 100, taxes: 50 })).toBe(150));
});

describe("buildExactFare", () => {
  it("returns undefined for null", () => expect(buildExactFare(null)).toBeUndefined());
  it("builds fare object", () => {
    const result = buildExactFare(250);
    expect(result).toEqual({ total: 250, totalFare: 250 });
  });
});

describe("getFlightFareBreakdown", () => {
  it("returns nulls for no flight", () => {
    expect(getFlightFareBreakdown(null)).toEqual({ adult: null, child: null, infant: null });
  });
  it("extracts paxPricing", () => {
    const flight = { paxPricing: { ADT: { base: 100, taxes: 20, total: 120 } } };
    expect(getFlightFareBreakdown(flight).adult).toBe(120);
  });
  it("falls back to price", () => {
    expect(getFlightFareBreakdown({ price: 300 }).adult).toBe(300);
  });
});

describe("calcFlightCost", () => {
  it("returns 0 for no flight", () => expect(calcFlightCost(null, 1, 0, 0)).toBe(0));
  it("multiplies per-pax fares", () => {
    const flight = {
      paxPricing: {
        ADT: { total: 100 },
        CHD: { total: 80 },
        INF: { total: 20 },
      },
    };
    expect(calcFlightCost(flight, 2, 1, 1)).toBe(300); // 200+80+20
  });
  it("uses totalPrice fallback", () => {
    expect(calcFlightCost({ totalPrice: 500 }, 2, 0, 0)).toBe(500);
  });
});

describe("calcHotelCost", () => {
  it("calculates correctly", () => expect(calcHotelCost(100, 3, 2)).toBe(600));
});

describe("calcActivityCost", () => {
  it("uses same price for children by default", () => expect(calcActivityCost(50, 2, 1)).toBe(150));
  it("uses custom child price", () => expect(calcActivityCost(50, 2, 1, 25)).toBe(125));
});

describe("formatTravelerBreakdown", () => {
  it("formats adults only", () => expect(formatTravelerBreakdown(2, 0, 0)).toBe("2 adults"));
  it("formats all pax types", () => expect(formatTravelerBreakdown(1, 2, 1)).toBe("1 adult, 2 children, 1 infant"));
});

describe("getAirlineInfo", () => {
  it("resolves IATA code", () => {
    const info = getAirlineInfo("EK");
    expect(info.code).toBe("EK");
    expect(info.logoUrl).toContain("EK.png");
  });
  it("handles empty string", () => {
    const info = getAirlineInfo("");
    expect(info.code).toBe("");
  });
});

describe("formatAirlineDisplay", () => {
  it("shows name + code", () => expect(formatAirlineDisplay({ code: "EK", name: "Emirates" })).toBe("Emirates (EK)"));
  it("falls back to name", () => expect(formatAirlineDisplay({ code: "", name: "Unknown" })).toBe("Unknown"));
});

describe("computeFlightDuration", () => {
  it("returns empty for missing input", () => expect(computeFlightDuration(undefined, undefined)).toBe(""));
  it("computes duration", () => {
    expect(computeFlightDuration("2025-01-01T10:00:00", "2025-01-01T13:30:00")).toBe("3h 30m");
  });
});

describe("prefixFlightNumber", () => {
  it("adds airline code prefix", () => expect(prefixFlightNumber("123", "EK")).toBe("EK123"));
  it("keeps existing prefix", () => expect(prefixFlightNumber("EK123", "EK")).toBe("EK123"));
});

describe("formatFlightTime", () => {
  it("extracts from ISO", () => expect(formatFlightTime("2025-01-01T14:30:00")).toBe("14:30"));
  it("returns TBD for empty", () => expect(formatFlightTime(undefined)).toBe("TBD"));
});

describe("resolveCity", () => {
  it("resolves known IATA", () => expect(resolveCity("DXB")).toBe("Dubai"));
  it("passes through non-IATA", () => expect(resolveCity("Paris")).toBe("Paris"));
});

describe("cleanInsightReason", () => {
  it("cleans 'no live data' phrases", () => {
    expect(cleanInsightReason("No live data available. Good choice.")).toBe("Live pricing is limited. Good choice.");
  });
});

describe("normalizeHotelText", () => {
  it("lowercases and strips special chars", () => {
    expect(normalizeHotelText("Grand Hotel & Spa")).toBe("grandhotelspa");
  });
});
