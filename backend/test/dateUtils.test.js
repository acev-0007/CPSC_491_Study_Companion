import { describe, it, expect } from "vitest";

import {
  getDateInTimeZone,
} from "../src/utils/dateUtils.js";

describe("Timezone Date Conversion", () => {
  it("converts UTC to California local date", () => {
    const date = new Date("2026-11-08T04:30:00Z");

    expect(
      getDateInTimeZone(date, "America/Los_Angeles")
    ).toBe("2026-11-07");
  });

  it("preserves the UTC calendar date", () => {
    const date = new Date("2026-11-08T04:30:00Z");

    expect(
      getDateInTimeZone(date, "UTC")
    ).toBe("2026-11-08");
  });
});