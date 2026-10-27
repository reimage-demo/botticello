import { call } from "./config.js";
const mount = document.querySelector("[data-estimate-form]");
if (mount) {
  mount.innerHTML = `<div class="estimate-progress" aria-label="Estimate request progress"><span aria-current="step">Contact</span><span>Vehicle</span><span>Issue</span><span>Photos & review</span></div>
<form id="estimate-form" novalidate><div class="hp" aria-hidden="true"><label>Website<input name="website" tabindex="-1" autocomplete="off"></label></div>
<fieldset data-stage="0"><legend>Your contact details</legend><p class="field-intro">The shop will use these details to follow up on your request.</p><div class="form-grid"><label class="full">Full name<input name="name" autocomplete="name" maxlength="100" required></label><label>Phone number<input name="phone" type="tel" autocomplete="tel" maxlength="30" required></label><label>Email address<input name="email" type="email" autocomplete="email" maxlength="200" required></label><label class="full">Preferred contact method<select name="preferredContactMethod"><option value="phone">Phone call</option><option value="text">Text message</option><option value="email">Email</option></select></label></div></fieldset>
<fieldset data-stage="1" hidden><legend>Tell us about your vehicle</legend><div class="form-grid"><label>Year<input name="vehicleYear" inputmode="numeric" pattern="[0-9]{4}" maxlength="4" placeholder="2018" required></label><label>Make<input name="vehicleMake" maxlength="60" placeholder="Ford" required></label><label>Model<input name="vehicleModel" maxlength="80" placeholder="F-150" required></label><label>Mileage (optional)<input name="mileage" inputmode="numeric" pattern="[0-9]{1,9}" maxlength="9" placeholder="65000"></label><label class="full">VIN (optional)<input name="vin" maxlength="17" minlength="17" pattern="[A-HJ-NPR-Za-hj-npr-z0-9]{17}" autocapitalize="characters" spellcheck="false" placeholder="17-character vehicle identification number"><small>Find it on your registration or at the base of the windshield. It helps us identify the right parts.</small></label><label class="full">Vehicle class<select name="duty"><option value="light">Light duty — car, SUV, pickup</option><option value="medium">Medium duty — work van or truck</option><option value="heavy">Heavy duty — commercial truck</option></select></label></div></fieldset>
<fieldset data-stage="2" hidden><legend>What needs attention?</legend><div class="form-grid"><label class="full">Service or concern<select name="service" required><option value="">Choose an issue</option><option>Maintenance</option><option>Diagnostics</option><option>Brakes</option><option>Tires & suspension</option><option>Engine</option><option>Transmission</option><option>Electrical / starting</option><option>Heating / air conditioning</option><option>Visible damage</option><option>Other / not sure</option></select></label><label>Affected area<select name="issueArea" required><option value="">Choose an area</option><option>Engine bay</option><option>Front of vehicle</option><option>Rear of vehicle</option><option>Driver side</option><option>Passenger side</option><option>Wheels / tires</option><option>Under the vehicle</option><option>Interior / dashboard</option><option>Multiple areas</option><option>Not sure</option></select></label><label>What have you noticed?<select name="issueType" required><option value="">Choose a symptom</option><option>Warning light</option><option>Unusual noise</option><option>Leak / fluid loss</option><option>Vibration / pulling</option><option>Won't start</option><option>Performance / shifting</option><option>Dent / scratch / broken part</option><option>Routine service</option><option>Other / not sure</option></select></label><label class="full">Vehicle condition<select name="severity" required><option value="">Choose a condition</option><option>Routine service</option><option>Still driving, but there is a concern</option><option>Not driveable</option><option>Not sure</option></select></label><label class="full">Describe the issue<textarea name="description" maxlength="4000" required placeholder="What happened? When does it happen? Include any recent repairs or dashboard messages."></textarea></label></div><div class="transport-needs"><label class="check"><input name="needsTow" type="checkbox"><span>Will you need a tow?</span></label><label class="check"><input name="needsRental" type="checkbox"><span>Will you need a rental?</span></label></div></fieldset>
<fieldset data-stage="3" hidden><legend>Add photos & review</legend><p class="field-intro">Show the affected area, a dashboard message, or visible damage. Photos are optional.</p><div class="upload-zone" id="estimate-drop"><label for="estimate-photos">Choose photos or drag them here</label><input id="estimate-photos" type="file" accept="image/jpeg,image/png,image/webp" multiple><p>Up to 6 JPG, PNG, or WebP files. Maximum 8 MB each.</p></div><div class="estimate-previews" id="estimate-previews"></div><details class="estimate-review" open><summary>Review your details</summary><div id="estimate-summary"></div></details><label class="check"><input name="consent" type="checkbox" required><span>I agree that Botticello Auto Repair may contact me about this request. I have read the <a href="privacy.html" target="_blank">privacy notice</a>.</span></label><p class="hint">The shop reviews every request. Final pricing may require an inspection. Submitting this form does not authorize repair work. See our <a href="terms.html" target="_blank" rel="noopener">terms of use</a>.</p></fieldset>
<p id="estimate-error" class="error" role="alert" hidden></p><div class="form-actions"><button class="btn outline" id="estimate-back" type="button" hidden>Back</button><button class="btn" id="estimate-next" type="button">Continue</button><button class="btn" id="estimate-send" type="submit" hidden>Submit estimate request</button></div><p class="submission-status" id="estimate-status" role="status"></p></form><section class="success" id="estimate-success" tabindex="-1" hidden></section>`;
  const form = mount.querySelector("form"),
    stages = [...form.querySelectorAll("[data-stage]")],
    back = mount.querySelector("#estimate-back"),
    next = mount.querySelector("#estimate-next"),
    send = mount.querySelector("#estimate-send"),
    error = mount.querySelector("#estimate-error"),
    input = mount.querySelector("#estimate-photos"),
    drop = mount.querySelector("#estimate-drop"),
    status = mount.querySelector("#estimate-status");
  let stage = 0,
    busy = false,
    request = null,
    files = [];
  const uploaded = new Map(),
    key = crypto.randomUUID().replaceAll("-", "");
  const escape = (s) =>
    String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  function fail(message) {
    error.textContent = message;
    error.hidden = false;
  }
  function clear() {
    error.hidden = true;
    error.textContent = "";
  }
  function valid() {
    for (const field of stages[stage].querySelectorAll("input,select,textarea"))
      if (!field.reportValidity()) return false;
    return true;
  }
  function review() {
    const d = new FormData(form);
    const rows = [
      ["Contact", `${d.get("name")} · ${d.get("phone")} · ${d.get("email")}`],
      ["Preferred contact", d.get("preferredContactMethod")],
      [
        "Vehicle",
        `${d.get("vehicleYear")} ${d.get("vehicleMake")} ${d.get("vehicleModel")} · ${d.get("duty")} duty`,
      ],
      ["VIN", String(d.get("vin") || "Not supplied").toUpperCase()],
      ["Mileage", d.get("mileage") || "Not supplied"],
      ["Service", d.get("service")],
      ["Issue", `${d.get("issueArea")} · ${d.get("issueType")}`],
      ["Condition", d.get("severity")],
      ["Tow needed", d.has("needsTow") ? "Yes" : "No"],
      ["Rental needed", d.has("needsRental") ? "Yes" : "No"],
      ["Details", d.get("description")],
    ];
    mount.querySelector("#estimate-summary").innerHTML =
      `<dl>${rows.map(([k, v]) => `<dt>${escape(k)}</dt><dd>${escape(v)}</dd>`).join("")}</dl>`;
  }
  function render() {
    stages.forEach((el, i) => (el.hidden = i !== stage));
    mount.querySelectorAll(".estimate-progress span").forEach((el, i) => {
      if (i === stage) el.setAttribute("aria-current", "step");
      else el.removeAttribute("aria-current");
    });
    back.hidden = stage === 0 || !!request;
    next.hidden = stage === 3;
    send.hidden = stage !== 3;
    if (stage === 3) review();
    const heading = stages[stage].querySelector("legend");
    heading.tabIndex = -1;
    heading.focus({ preventScroll: true });
    stages[stage].scrollIntoView({ block: "start" });
  }
  next.addEventListener("click", () => {
    if (valid()) {
      clear();
      stage++;
      render();
    }
  });
  back.addEventListener("click", () => {
    if (request || busy) return;
    clear();
    stage--;
    render();
  });
  function previews() {
    const target = mount.querySelector("#estimate-previews");
    target.replaceChildren();
    files.forEach((item, index) => {
      const figure = document.createElement("figure"),
        img = document.createElement("img"),
        remove = document.createElement("button");
      img.src = item.url;
      img.alt = `Selected vehicle photo ${index + 1}`;
      remove.type = "button";
      remove.textContent = "Remove";
      remove.setAttribute("aria-label", `Remove ${item.file.name}`);
      remove.disabled = busy || !!request;
      remove.addEventListener("click", () => {
        if (busy || request) return;
        URL.revokeObjectURL(item.url);
        files.splice(index, 1);
        previews();
      });
      figure.append(img, remove);
      target.append(figure);
    });
  }
  function add(incoming) {
    if (busy || request) return;
    clear();
    const add = [...incoming].filter(
      (f) =>
        !files.some(
          (x) =>
            x.file.name === f.name &&
            x.file.size === f.size &&
            x.file.lastModified === f.lastModified,
        ),
    );
    if (
      files.length + add.length > 6 ||
      add.some(
        (f) =>
          !["image/jpeg", "image/png", "image/webp"].includes(f.type) ||
          f.size > 8 * 1024 * 1024,
      )
    ) {
      fail(
        "Choose up to six JPG, PNG, or WebP photos under 8 MB each. Your existing photos are still selected.",
      );
      return;
    }
    files.push(
      ...add.map((file) => ({ file, url: URL.createObjectURL(file) })),
    );
    previews();
  }
  input.addEventListener("change", () => {
    add(input.files);
    input.value = "";
  });
  drop.addEventListener("dragover", (e) => {
    e.preventDefault();
    drop.classList.add("dragging");
  });
  drop.addEventListener("dragleave", () => drop.classList.remove("dragging"));
  drop.addEventListener("drop", (e) => {
    e.preventDefault();
    drop.classList.remove("dragging");
    add(e.dataTransfer.files);
  });
  const service = new URLSearchParams(location.search).get("service");
  if (
    service &&
    [...form.elements.service.options].some((o) => o.value === service)
  )
    form.elements.service.value = service;
  form.elements.vin.addEventListener("input", (e) => {
    e.target.value = e.target.value.toUpperCase();
  });
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (busy) return;
    if (stage < 3) {
      if (valid()) {
        stage++;
        render();
      }
      return;
    }
    if (!valid()) return;
    clear();
    busy = true;
    previews();
    send.disabled = back.disabled = input.disabled = true;
    status.textContent = "Sending your request…";
    try {
      if (!request) {
        const d = new FormData(form),
          payload = {
            kind: "estimate",
            submissionKey: key,
            website: String(d.get("website") || ""),
          };
        for (const k of [
          "name",
          "email",
          "phone",
          "vehicleYear",
          "vehicleMake",
          "vehicleModel",
          "duty",
          "service",
          "issueArea",
          "issueType",
          "severity",
          "description",
          "preferredContactMethod",
        ])
          payload[k] = String(d.get(k) || "").trim();
        payload.needsTow = d.has("needsTow");
        payload.needsRental = d.has("needsRental");
        payload.vehicle = `${payload.vehicleYear} ${payload.vehicleMake} ${payload.vehicleModel}`;
        if (d.get("vin"))
          payload.vin = String(d.get("vin")).trim().toUpperCase();
        if (d.get("mileage")) payload.mileage = String(d.get("mileage")).trim();
        request = {
          id: await call("mutation", "requests:start", payload),
          submissionKey: key,
        };
        back.hidden = true;
        previews();
      }
      for (let i = 0; i < files.length; i++) {
        const state = uploaded.get(i) || {};
        if (state.attached) continue;
        status.textContent = `Uploading photo ${i + 1} of ${files.length}…`;
        if (!state.storageId) {
          const url = await call("mutation", "requests:uploadUrl", request),
            response = await fetch(url, {
              method: "POST",
              headers: { "Content-Type": files[i].file.type },
              body: files[i].file,
            });
          if (!response.ok)
            throw Error("A photo could not upload. Please retry.");
          state.storageId = (await response.json()).storageId;
          uploaded.set(i, state);
        }
        await call("mutation", "requests:attach", {
          ...request,
          storageId: state.storageId,
        });
        state.attached = true;
      }
      const result = await call("mutation", "requests:finish", request);
      form.hidden = true;
      mount.querySelector(".estimate-progress").hidden = true;
      const done = mount.querySelector("#estimate-success");
      done.innerHTML = `<h3>Your request has reached the shop.</h3><p>Reference: <strong>${escape(result.reference)}</strong></p><p>We’ll review your vehicle details and photos, then contact you about pricing and next steps.</p><a class="btn" href="appointments.html">Book an appointment</a>`;
      done.hidden = false;
      done.focus();
      files.forEach((x) => URL.revokeObjectURL(x.url));
    } catch (err) {
      fail(
        request
          ? `Your details were saved. ${err.message} Select Submit estimate request to finish sending.`
          : err.message,
      );
      status.textContent = "";
    } finally {
      busy = false;
      send.disabled = false;
      back.disabled = false;
      input.disabled = !!request;
      if (!form.hidden) previews();
    }
  });
}
