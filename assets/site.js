import logoUrl from "./branding/botticello-logo.webp";
import { shopStatus } from "./shop-hours.js";
const path = location.pathname.split("/").pop() || "index.html";
const links = [
  ["Services", "services.html"],
  ["Cars for sale", "inventory.html"],
  ["Visit the shop", "contact.html"],
];
const brand = `<a class="brand-link" href="index.html" aria-label="Botticello Auto Repair home"><img src="${logoUrl}" width="2170" height="725" alt="Botticello Auto Repair"></a>`;
document.querySelector("[data-header]").innerHTML =
  `<a href="#main" class="skip">Skip to content</a><header><div class="nav wrap">${brand}<nav class="navlinks" id="navigation" aria-label="Main navigation">${links.map(([t, p]) => `<a href="${p}" ${path === p ? 'aria-current="page"' : ""}>${t}</a>`).join("")}<a href="index.html#estimate">Online estimate</a></nav><a class="btn small" href="appointments.html">Book an appointment</a><button class="menu" aria-controls="navigation" aria-expanded="false">Menu</button></div></header>`;
document.querySelector(".menu").addEventListener("click", (e) => {
  const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
  e.currentTarget.setAttribute("aria-expanded", String(open));
  document.querySelector(".navlinks").classList.toggle("open", open);
});
document.querySelector("[data-footer]").innerHTML =
  `<footer><div class="wrap"><div class="footer-top">${brand}<nav aria-label="Footer"><a href="services.html">Services</a><a href="appointments.html">Book an appointment</a><a href="estimate.html">Online estimate</a><a href="inventory.html">Cars for sale</a><a href="contact.html">Contact</a></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Botticello Auto Repair. 210 South Street, West Hartford, CT 06110</span><a href="privacy.html">Privacy</a></div></div></footer>`;
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
