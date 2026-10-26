// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from "vitest";
const { call } = vi.hoisted(() => ({ call: vi.fn() }));
vi.mock("../assets/config.js", () => ({ call }));
const field = (name: string) =>
  document.querySelector(`[name="${name}"]`) as HTMLInputElement;
const click = (id: string) =>
  (document.getElementById(id) as HTMLButtonElement).click();
const stage = () =>
  document
    .querySelector("[data-stage]:not([hidden])")
    ?.getAttribute("data-stage");
function values(data: Record<string, string>) {
  for (const [name, value] of Object.entries(data)) field(name).value = value;
}
function toReview() {
  values({
    name: "Preview Customer",
    phone: "8605550100",
    email: "preview@example.com",
  });
  click("estimate-next");
  values({
    vehicleYear: "2018",
    vehicleMake: "Ford",
    vehicleModel: "F-150",
    vin: "1FTFW1EF1EFA00001",
    mileage: "65000",
  });
  click("estimate-next");
  values({
    service: "Brakes",
    issueArea: "Front of vehicle",
    issueType: "Unusual noise",
    severity: "Still driving, but there is a concern",
    description: "Noise when braking.",
  });
  click("estimate-next");
  field("consent").checked = true;
}
beforeEach(async () => {
  vi.resetModules();
  call.mockReset();
  document.body.innerHTML = "<div data-estimate-form></div>";
  Element.prototype.scrollIntoView = vi.fn();
  URL.createObjectURL = vi.fn(() => "blob:preview");
  URL.revokeObjectURL = vi.fn();
  await import("../assets/estimate-form.js");
});
describe("estimate form in the browser DOM", () => {
  it("validates each step, preserves details when going back, and escapes the review", () => {
    click("estimate-next");
    expect(stage()).toBe("0");
    toReview();
    expect(stage()).toBe("3");
    click("estimate-back");
    expect(stage()).toBe("2");
    expect(field("description").value).toBe("Noise when braking.");
    field("description").value = "<img src=x onerror=alert(1)>";
    click("estimate-next");
    expect(document.querySelector("#estimate-summary img")).toBeNull();
    expect(document.querySelector("#estimate-summary")?.textContent).toContain(
      "<img src=x",
    );
    expect(call).not.toHaveBeenCalled();
  });
  it("allows adding and removing photos before submission", () => {
    toReview();
    const input = document.getElementById(
      "estimate-photos",
    ) as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["photo"], "damage.jpg", { type: "image/jpeg" })],
    });
    input.dispatchEvent(new Event("change"));
    expect(document.querySelectorAll("#estimate-previews img")).toHaveLength(1);
    (
      document.querySelector("#estimate-previews button") as HTMLButtonElement
    ).click();
    expect(document.querySelectorAll("#estimate-previews img")).toHaveLength(0);
    expect(URL.revokeObjectURL).toHaveBeenCalledWith("blob:preview");
  });
  it("retries a saved request without creating another request or uploading a photo twice", async () => {
    toReview();
    const input = document.getElementById(
      "estimate-photos",
    ) as HTMLInputElement;
    Object.defineProperty(input, "files", {
      value: [new File(["photo"], "damage.jpg", { type: "image/jpeg" })],
    });
    input.dispatchEvent(new Event("change"));
    let attachCount = 0;
    call.mockImplementation(async (_kind: string, fn: string) => {
      if (fn === "requests:start") return "request-123";
      if (fn === "requests:uploadUrl") return "https://example.test/upload";
      if (fn === "requests:attach" && attachCount++ === 0)
        throw Error("Temporary connection failure");
      if (fn === "requests:finish") return { reference: "ABC123" };
    });
    const fetchMock = vi
      .fn()
      .mockResolvedValue({
        ok: true,
        json: async () => ({ storageId: "photo-123" }),
      });
    vi.stubGlobal("fetch", fetchMock);
    click("estimate-send");
    await vi.waitFor(() =>
      expect(document.getElementById("estimate-error")?.textContent).toContain(
        "Your details were saved",
      ),
    );
    expect(
      (document.querySelector("#estimate-previews button") as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    click("estimate-send");
    await vi.waitFor(() =>
      expect(
        document.getElementById("estimate-success")?.textContent,
      ).toContain("ABC123"),
    );
    expect(
      call.mock.calls.filter((c) => c[1] === "requests:start"),
    ).toHaveLength(1);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(
      call.mock.calls.find((c) => c[1] === "requests:start")?.[2],
    ).toMatchObject({
      vehicle: "2018 Ford F-150",
      vin: "1FTFW1EF1EFA00001",
      mileage: "65000",
      issueArea: "Front of vehicle",
      preferredContactMethod: "phone",
    });
    vi.unstubAllGlobals();
  });
});
