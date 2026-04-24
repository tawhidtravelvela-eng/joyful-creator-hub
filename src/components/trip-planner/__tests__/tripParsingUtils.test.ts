import { describe, it, expect } from "vitest";
import { parseItinerary, getTextContent, sanitizeRetryContent, isTransientAssistantStatusMessage, sanitizeMessages } from "../tripParsingUtils";

const MINIMAL_ITINERARY = JSON.stringify({
  trip_title: "Test Trip",
  destination: "Tokyo",
  duration_days: 3,
  travelers: 2,
  budget_estimate: { currency: "USD", total: 3000, breakdown: { flights: 1000, hotels: 1500, activities: 500 } },
  days: [
    { day: 1, title: "Arrival", activities: [{ time: "10:00", activity: "Arrive", description: "", cost_estimate: 0, category: "transport" }], hotel: { name: "Hotel A", area: "Shinjuku", price_per_night: 150, stars: 4 } },
  ],
  tips: ["Pack light"],
  best_time_to_visit: "Spring",
});

describe("parseItinerary", () => {
  it("returns null for empty input", () => expect(parseItinerary("")).toBeNull());

  it("parses direct JSON", () => {
    const result = parseItinerary(MINIMAL_ITINERARY);
    expect(result).not.toBeNull();
    expect(result!.destination).toBe("Tokyo");
    expect(result!.days).toHaveLength(1);
  });

  it("parses fenced JSON", () => {
    const result = parseItinerary("Here's your plan:\n```json\n" + MINIMAL_ITINERARY + "\n```\nEnjoy!");
    expect(result).not.toBeNull();
    expect(result!.trip_title).toBe("Test Trip");
  });

  it("parses embedded JSON in text", () => {
    const result = parseItinerary("Great trip! " + MINIMAL_ITINERARY + " Enjoy your vacation!");
    expect(result).not.toBeNull();
  });

  it("creates fallback itinerary from any valid JSON object", () => {
    // normalizeItinerary is lenient — it creates a minimal plan from any object
    const result = parseItinerary('{"name": "test"}');
    expect(result).not.toBeNull();
    expect(result!.trip_title).toBe("Your Trip Plan");
  });
});

describe("getTextContent", () => {
  it("returns ready message for pure JSON itinerary", () => {
    expect(getTextContent(MINIMAL_ITINERARY)).toContain("ready");
  });

  it("returns empty for empty input", () => {
    expect(getTextContent("")).toBe("");
  });

  it("strips embedded JSON and keeps text", () => {
    const mixed = "Here's your trip! " + MINIMAL_ITINERARY + " Have a great time!";
    const result = getTextContent(mixed);
    expect(result).not.toContain('"trip_title"');
  });
});

describe("sanitizeRetryContent", () => {
  it("strips __retry__ prefix", () => {
    expect(sanitizeRetryContent("__retry__hello")).toBe("hello");
  });
  it("leaves normal content alone", () => {
    expect(sanitizeRetryContent("hello")).toBe("hello");
  });
});

describe("isTransientAssistantStatusMessage", () => {
  it("detects transient messages", () => {
    expect(isTransientAssistantStatusMessage("I have everything I need! Searching for the best options now.")).toBe(true);
  });
  it("rejects normal messages", () => {
    expect(isTransientAssistantStatusMessage("Here's your itinerary for Tokyo")).toBe(false);
  });
});

describe("sanitizeMessages", () => {
  it("filters transient assistant messages", () => {
    const msgs = [
      { role: "user" as const, content: "Plan a trip to Tokyo" },
      { role: "assistant" as const, content: "I have everything I need! Searching for the best options now." },
      { role: "assistant" as const, content: "Here's your plan for Tokyo!" },
    ];
    const result = sanitizeMessages(msgs);
    expect(result).toHaveLength(2);
  });

  it("strips __retry__ from user messages", () => {
    const msgs = [{ role: "user" as const, content: "__retry__Plan a trip" }];
    expect(sanitizeMessages(msgs)[0].content).toBe("Plan a trip");
  });
});
