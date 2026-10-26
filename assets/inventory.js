import { call } from "./config.js";
const list = document.querySelector("#inventory"),
  search = document.querySelector("#search"),
  sort = document.querySelector("#sort");
let vehicles = [];
const escape = (s) =>
  String(s).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function render() {
  let rows = vehicles.filter((v) =>
    `${v.year} ${v.make} ${v.model}`
      .toLowerCase()
      .includes(search.value.toLowerCase()),
  );
  if (sort.value === "price-low") rows.sort((a, b) => a.price - b.price);
  if (sort.value === "price-high") rows.sort((a, b) => b.price - a.price);
  document.querySelector("#count").textContent =
    `${rows.length} vehicle${rows.length === 1 ? "" : "s"}`;
  list.innerHTML = rows.length
    ? rows
        .map(
          (v) =>
            `<article class="vehicle">${v.photoUrls[0] ? `<img src="${escape(v.photoUrls[0])}" alt="${escape(`${v.year} ${v.make} ${v.model}`)}" loading="lazy">` : ""}<div class="vehicle-body"><p class="eyebrow">${escape(v.mileage.toLocaleString())} MILES</p><h3>${escape(`${v.year} ${v.make} ${v.model}`)}</h3><strong>${v.price ? escape(new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(v.price)) : "Call for price"}</strong><p>${escape(v.description)}</p><a class="btn" href="tel:+18609535622">Ask about this vehicle ↗</a></div></article>`,
        )
        .join("")
    : `<div class="empty"><p class="eyebrow">CARS FOR SALE</p><h3>${vehicles.length ? "No matching vehicles." : "Something good could be around the corner."}</h3><p>${vehicles.length ? "Try another make or model." : "There are no vehicles listed online right now. Call the shop to ask about current availability."}</p><a class="btn" href="tel:+18609535622">Call 860-953-5622 ↗</a></div>`;
}
search.addEventListener("input", render);
sort.addEventListener("change", render);
async function load() {
  try {
    vehicles = await call("query", "inventory:available");
    render();
  } catch {
    list.innerHTML =
      '<div class="empty"><h3>We couldn’t load the vehicles.</h3><p>Please refresh or call us for current availability.</p><a class="btn" href="tel:+18609535622">Call the shop ↗</a></div>';
  }
}
void load();
