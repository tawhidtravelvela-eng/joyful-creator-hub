import { describe, it, expect, beforeEach } from "vitest";
import { generateConversationTitle } from "../tripCacheHelpers";
import type { Msg } from "../tripTypes";

describe("generateConversationTitle", () => {
  it("returns 'Untitled Trip' for empty messages", () => {
    expect(generateConversationTitle([])).toBe("Untitled Trip");
  });

  it("extracts destination from 'trip to X'", () => {
    const msgs: Msg[] = [{ role: "user", content: "Plan a trip to Bangkok for 5 days" }];
    expect(generateConversationTitle(msgs)).toContain("Bangkok");
  });

  it("truncates long first message", () => {
    const msgs: Msg[] = [{ role: "user", content: "A".repeat(60) }];
    const title = generateConversationTitle(msgs);
    expect(title.length).toBeLessThanOrEqual(41); // 40 + "…"
  });

  it("ignores assistant messages", () => {
    const msgs: Msg[] = [
      { role: "assistant", content: "Welcome! Where to?" },
      { role: "user", content: "Going to Paris next week" },
    ];
    expect(generateConversationTitle(msgs)).toContain("Paris");
  });
});
