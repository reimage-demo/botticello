import { describe, expect, it } from "vitest";
// @ts-expect-error Public vanilla JavaScript module.
import { shopStatus } from "../assets/shop-hours.js";
describe("shop hours in Connecticut", () => {
  it("uses Eastern time and the exact opening and closing boundaries", () => {
    expect(shopStatus(new Date("2026-10-26T11:59:00Z")).open).toBe(false);
    expect(shopStatus(new Date("2026-10-26T12:00:00Z")).open).toBe(true);
    expect(shopStatus(new Date("2026-10-26T20:59:00Z")).open).toBe(true);
    expect(shopStatus(new Date("2026-10-26T21:00:00Z")).open).toBe(false);
    expect(shopStatus(new Date("2026-12-07T12:59:00Z")).open).toBe(false);
    expect(shopStatus(new Date("2026-12-07T13:00:00Z")).open).toBe(true);
  });
  it("handles Friday evenings, weekends, and local midnight", () => {
    expect(shopStatus(new Date("2026-10-30T21:00:00Z")).label).toContain(
      "Monday",
    );
    expect(shopStatus(new Date("2026-10-31T16:00:00Z")).open).toBe(false);
    expect(shopStatus(new Date("2026-11-01T16:00:00Z")).label).toContain(
      "Monday",
    );
    expect(shopStatus(new Date("2026-10-27T02:00:00Z")).day).toBe("Monday");
    expect(shopStatus(new Date("2026-10-27T04:00:00Z")).label).toContain(
      "today",
    );
  });
});
