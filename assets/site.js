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
