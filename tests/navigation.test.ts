// @vitest-environment jsdom
import { expect, it, vi } from "vitest";

it("lets customers open and dismiss mobile navigation with keyboard, links, and outside taps", async () => {
  document.body.innerHTML = `<header>
    <button class="menu" aria-expanded="false">Menu</button>
    <nav class="navlinks"><a href="#services">Services</a></nav>
  </header><main id="services">Services</main>`;
  let breakpointChanged = () => {};
  vi.stubGlobal("matchMedia", () => ({
    addEventListener: (_event: string, callback: () => void) => {
      breakpointChanged = callback;
    },
  }));
  await import("../assets/site.js");
  const menu = document.querySelector<HTMLButtonElement>(".menu")!;
  const navigation = document.querySelector(".navlinks")!;
  const link = document.querySelector<HTMLAnchorElement>("nav a")!;
  menu.click();
  expect(menu.getAttribute("aria-expanded")).toBe("true");
  expect(document.activeElement).toBe(link);
  document.dispatchEvent(new KeyboardEvent("keydown", { key: "Escape" }));
  expect(navigation.classList.contains("open")).toBe(false);
  expect(document.activeElement).toBe(menu);
  menu.click();
  document
    .querySelector("main")!
    .dispatchEvent(new Event("pointerdown", { bubbles: true }));
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  menu.click();
  link.click();
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  menu.click();
  breakpointChanged();
  expect(menu.getAttribute("aria-expanded")).toBe("false");
  vi.unstubAllGlobals();
});
