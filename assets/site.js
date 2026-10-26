import { shopStatus } from "./shop-hours.js";
const menu = document.querySelector(".menu");
const navigation = document.querySelector(".navlinks");
menu?.addEventListener("click", () => {
  const open = menu.getAttribute("aria-expanded") !== "true";
  menu.setAttribute("aria-expanded", String(open));
  navigation?.classList.toggle("open", open);
});
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
