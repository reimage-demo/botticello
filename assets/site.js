import { shopStatus } from "./shop-hours.js";
const menu = document.querySelector(".menu");
const navigation = document.querySelector(".navlinks");
function setMenu(open, restoreFocus = false) {
  menu?.setAttribute("aria-expanded", String(open));
  navigation?.classList.toggle("open", open);
  if (open) navigation?.querySelector("a")?.focus();
  else if (restoreFocus) menu?.focus();
}
menu?.addEventListener("click", () => {
  setMenu(menu.getAttribute("aria-expanded") !== "true");
});
navigation?.addEventListener("click", (event) => {
  if (event.target.closest("a")) setMenu(false);
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && menu?.getAttribute("aria-expanded") === "true")
    setMenu(false, true);
});
document.addEventListener("pointerdown", (event) => {
  if (
    !event.target.closest("header") &&
    menu?.getAttribute("aria-expanded") === "true"
  )
    setMenu(false);
});
window
  .matchMedia("(max-width: 900px)")
  .addEventListener("change", () => setMenu(false));
document.querySelectorAll("[data-year]").forEach((el) => {
  el.textContent = String(new Date().getFullYear());
});
function updateHours() {
  const current = shopStatus();
  document.querySelectorAll("[data-shop-status]").forEach((el) => {
    el.textContent = current.label;
  });
  document.querySelectorAll("[data-day]").forEach((el) => {
    if (el.dataset.day === current.day) el.setAttribute("aria-current", "date");
    else el.removeAttribute("aria-current");
  });
}
updateHours();
if (document.querySelector("[data-shop-status]"))
  setInterval(updateHours, 60000);

// Progressive enhancement: content stays visible without JS or observer support.
const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)");
if (!reducedMotion.matches && "IntersectionObserver" in window) {
  const sections = [
    ...document.querySelectorAll("main > section:not(.hero):not(.pagehead)"),
  ];
  const observer = new IntersectionObserver(
    (entries) => {
      for (const entry of entries)
        if (entry.isIntersecting) {
          entry.target.classList.remove("scroll-reveal");
          observer.unobserve(entry.target);
        }
    },
    { threshold: 0.01, rootMargin: "0px 0px 40px 0px" },
  );
  for (const section of sections) {
    if (section.getBoundingClientRect().top > window.innerHeight) {
      section.classList.add("scroll-reveal");
      observer.observe(section);
    }
  }
  const showAll = () => {
    sections.forEach((section) => section.classList.remove("scroll-reveal"));
    observer.disconnect();
  };
  reducedMotion.addEventListener("change", showAll);
  document.addEventListener("focusin", (event) =>
    event.target.closest(".scroll-reveal")?.classList.remove("scroll-reveal"),
  );
  window.addEventListener("beforeprint", showAll);
}
