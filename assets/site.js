const path = location.pathname.split("/").pop() || "index.html";
const links = [
  ["Services", "services.html"],
  ["Cars for sale", "inventory.html"],
  ["Visit us", "contact.html"],
];
document.querySelector("[data-header]").innerHTML =
  `<a href="#main" class="skip">Skip to content</a><div class="topbar"><div class="wrap"><span>210 SOUTH STREET · WEST HARTFORD, CT</span><span>MON–FRI 8–5 &nbsp; / &nbsp; <a href="tel:+18609535622">860-953-5622</a></span></div></div><header><div class="nav wrap"><a class="wordmark" href="index.html" aria-label="Botticello Auto Repair home">BOTTICELLO<small>AUTO REPAIR · WEST HARTFORD</small></a><nav class="navlinks" id="navigation" aria-label="Main navigation">${links.map(([t, p]) => `<a href="${p}" ${path === p ? 'aria-current="page"' : ""}>${t}</a>`).join("")}</nav><a class="btn small" href="estimate.html">Get an estimate <span aria-hidden="true">↗</span></a><button class="menu" aria-controls="navigation" aria-expanded="false" aria-label="Toggle navigation">☰</button></div></header>`;
document.querySelector(".menu").addEventListener("click", (e) => {
  const open = e.currentTarget.getAttribute("aria-expanded") !== "true";
  e.currentTarget.setAttribute("aria-expanded", String(open));
  document.querySelector(".navlinks").classList.toggle("open", open);
});
document.querySelector("[data-footer]").innerHTML =
  `<footer><div class="wrap"><div class="footer-top"><a class="wordmark" href="index.html">BOTTICELLO<small>AUTO REPAIR · WEST HARTFORD</small></a><nav aria-label="Footer"><a href="services.html">Services</a><a href="appointments.html">Request an appointment</a><a href="inventory.html">Cars for sale</a><a href="contact.html">Contact</a></nav></div><div class="footer-bottom"><span>© ${new Date().getFullYear()} Botticello Auto Repair. &nbsp;210 South Street, West Hartford, CT 06110</span><a href="privacy.html">Privacy</a></div></div></footer>`;
