// @vitest-environment node
import { expect, it } from "vitest";
import {
  requireSecurePage,
  requireHttpsUrl,
} from "../assets/secure-transport.js";
it("blocks customer transmission from insecure public pages and to non-HTTPS endpoints", () => {
  expect(() =>
    requireSecurePage({ hostname: "shop.example", protocol: "http:" }),
  ).toThrow("HTTPS");
  expect(() =>
    requireSecurePage({ hostname: "shop.example", protocol: "https:" }),
  ).not.toThrow();
  expect(() =>
    requireSecurePage({ hostname: "127.0.0.1", protocol: "http:" }),
  ).not.toThrow();
  for (const url of [
    "http://example.com",
    "https://user:password@example.com",
    "javascript:alert(1)",
  ])
    expect(() => requireHttpsUrl(url)).toThrow();
  expect(requireHttpsUrl("https://sincere-turtle-299.convex.cloud")).toBe(
    "https://sincere-turtle-299.convex.cloud/",
  );
});
