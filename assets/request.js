import { call, uploadPhoto } from "./config.js";
const form = document.querySelector("#request-form"),
  steps = [...form.querySelectorAll("[data-step]")],
  next = document.querySelector("#next"),
  back = document.querySelector("#back"),
  submit = document.querySelector("#submit"),
  error = document.querySelector("#form-error");
let step = 0,
  request = null,
  busy = false;
const uploaded = new Set();
let files = [];
let previewUrls = [];
const key = crypto.randomUUID().replaceAll("-", "");
const showError = (message) => {
  error.textContent = message;
  error.hidden = false;
};
const clearError = () => {
  error.hidden = true;
  error.textContent = "";
};
const text = (v) =>
  String(v).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
function validStep() {
  for (const input of steps[step].querySelectorAll("input,select,textarea"))
    if (!input.reportValidity()) return false;
  return true;
}
function render() {
  steps.forEach((s, i) => (s.hidden = i !== step));
  document
    .querySelectorAll(".progress span")
    .forEach((s, i) => s.classList.toggle("active", i <= step));
  back.hidden = step === 0;
  next.hidden = step === 2;
  submit.hidden = step !== 2;
  if (step === 2) {
    const d = new FormData(form);
    const rows = [
      ["Vehicle", d.get("vehicle")],
      ["Class", `${d.get("duty")} duty`],
      ["Service", d.get("service")],
      ["Details", d.get("description") || "No additional details"],
      ["Contact", `${d.get("name")} · ${d.get("email")} · ${d.get("phone")}`],
      ["Photos", files.length],
    ];
    if (d.get("preferredDate"))
      rows.push([
        "Preferred visit",
        `${d.get("preferredDate")} · ${d.get("preferredTime")}`,
      ]);
    document.querySelector("#review").innerHTML =
      `<dl>${rows.map(([k, v]) => `<dt>${text(k)}</dt><dd>${text(v)}</dd>`).join("")}</dl>`;
  }
  steps[step].querySelector("input,select,legend")?.focus();
}
next.addEventListener("click", () => {
  if (!validStep()) return;
  clearError();
  step++;
  render();
});
back.addEventListener("click", () => {
  clearError();
  step--;
  render();
});
const photoInput = document.querySelector("#photos");
photoInput.addEventListener("change", () => {
  clearError();
  const selected = [...photoInput.files];
  if (
    selected.length > 6 ||
    selected.some(
      (f) =>
        !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
        f.size > 8 * 1024 * 1024,
    )
  ) {
    photoInput.value = "";
    files = [];
    showError("Choose up to 6 JPEG, PNG, or WebP photos, each under 8 MB.");
  } else files = selected;
  previewUrls.forEach(URL.revokeObjectURL);
  previewUrls = files.map((f) => URL.createObjectURL(f));
  document.querySelector("#photo-previews").replaceChildren(
    ...previewUrls.map((url, i) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = `Selected photo ${i + 1}`;
      return img;
    }),
  );
});
const date = form.elements.preferredDate;
if (date) {
  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  date.min = today;
  const max = new Date(`${today}T12:00:00Z`);
  max.setUTCDate(max.getUTCDate() + 180);
  date.max = max.toISOString().slice(0, 10);
  date.addEventListener("change", () =>
    date.setCustomValidity(
      [0, 6].includes(new Date(`${date.value}T12:00:00Z`).getUTCDay())
        ? "Please choose Monday through Friday."
        : "",
    ),
  );
}
const selectedService = new URLSearchParams(location.search).get("service");
if (
  selectedService &&
  [...form.elements.service.options].some((o) => o.value === selectedService)
)
  form.elements.service.value = selectedService;
form.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (busy) return;
  if (step < 2) {
    if (validStep()) {
      step++;
      render();
    }
    return;
  }
  busy = true;
  clearError();
  submit.disabled = true;
  back.disabled = true;
  submit.textContent = "Sending…";
  try {
    if (!request) {
      const d = new FormData(form);
      const payload = {
        kind: form.dataset.kind,
        submissionKey: key,
        website: String(d.get("website") || ""),
      };
      for (const k of [
        "vehicle",
        "duty",
        "service",
        "description",
        "name",
        "email",
        "phone",
      ])
        payload[k] = String(d.get(k) || "").trim();
      if (date) {
        payload.preferredDate = date.value;
        payload.preferredTime = String(d.get("preferredTime"));
      }
      request = {
        id: await call("mutation", "requests:start", payload),
        submissionKey: key,
      };
    }
    for (let i = 0; i < files.length; i++) {
      if (uploaded.has(i)) continue;
      submit.textContent = `Uploading photo ${i + 1} of ${files.length}…`;
      await uploadPhoto(request, files[i], String(i));
      uploaded.add(i);
    }
    const result = await call("mutation", "requests:finish", request);
    form.hidden = true;
    document.querySelector(".progress").hidden = true;
    const done = document.querySelector("#success");
    done.innerHTML = `<p>Request reference: ${text(result.reference)}</p><h2>Your request has reached the shop.</h2><p>We’ll contact you using the details you provided.</p><p>${form.dataset.kind === "appointment" ? "Your appointment is not confirmed yet. Please wait for confirmation from our team." : "Our team will review the details and discuss pricing and any inspection needed."}</p><a class="btn" href="index.html">Back to home</a>`;
    done.hidden = false;
    done.focus();
  } catch (err) {
    showError(err.message);
    if (request) {
      back.hidden = true;
      photoInput.disabled = true;
    }
  } finally {
    busy = false;
    submit.disabled = false;
    back.disabled = false;
    submit.textContent = "Send request";
  }
});
