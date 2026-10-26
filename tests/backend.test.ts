import { describe, it, expect } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api } from "../convex/_generated/api";
const modules = import.meta.glob("../convex/**/*.ts");
const payload = {
  kind: "estimate" as const,
  name: "Test Customer",
  email: "test@example.com",
  phone: "8605550100",
  vehicle: "2018 Ford F-150",
  duty: "light" as const,
  service: "Brakes",
  description: "Noise under braking",
  submissionKey: "test-submission-key-1234567890",
};
async function admin(t: ReturnType<typeof convexTest>) {
  const userId = await t.run(async (ctx) => {
    const id = await ctx.db.insert("users", { email: "staff@example.com" });
    await ctx.db.insert("admins", {
      userId: id,
      email: "staff@example.com",
      active: true,
    });
    return id;
  });
  return t.withIdentity({ subject: `${userId}|testsession` });
}
describe("shop access and workflow", () => {
  it("blocks anonymous and unapproved access to customer records and inventory changes", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.requests.list, {})).rejects.toThrow(
      "Sign in required",
    );
    await expect(t.query(api.inventory.list, {})).rejects.toThrow(
      "Sign in required",
    );
    await expect(t.mutation(api.inventory.uploadUrl, {})).rejects.toThrow(
      "Sign in required",
    );
    const id = await t.run((ctx) =>
      ctx.db.insert("users", { email: "outsider@example.com" }),
    );
    await expect(
      t.withIdentity({ subject: `${id}|session` }).query(api.requests.list, {}),
    ).rejects.toThrow("Administrator access");
  });
  it("saves a request once, protects its submission, and exposes only finalized requests to admins", async () => {
    const t = convexTest(schema, modules),
      staff = await admin(t);
    const id = await t.mutation(api.requests.start, payload);
    expect(await t.mutation(api.requests.start, payload)).toBe(id);
    expect(await staff.query(api.requests.list, {})).toEqual([]);
    await expect(
      t.mutation(api.requests.finish, { id, submissionKey: "wrong" }),
    ).rejects.toThrow("Request not found");
    await t.mutation(api.requests.finish, {
      id,
      submissionKey: payload.submissionKey,
    });
    await t.mutation(api.requests.finish, {
      id,
      submissionKey: payload.submissionKey,
    });
    const rows = await staff.query(api.requests.list, {});
    expect(rows).toHaveLength(1);
    expect(rows[0]).not.toHaveProperty("submissionKey");
    await staff.mutation(api.requests.update, {
      id,
      status: "contacted",
      quoteMin: 150,
      quoteMax: 250,
      note: "Call to schedule inspection",
    });
    const updated = (await staff.query(api.requests.list, {}))[0];
    expect(updated.quoteMin).toBe(150);
    expect(updated.notes[0].text).toContain("inspection");
    await expect(
      staff.mutation(api.requests.update, { id, status: "new", quoteMax: 50 }),
    ).rejects.toThrow("Maximum");
  });
  it("validates contacts, dates, spam and request limits", async () => {
    const t = convexTest(schema, modules);
    await expect(
      t.mutation(api.requests.start, { ...payload, email: "invalid" }),
    ).rejects.toThrow("valid email");
    await expect(
      t.mutation(api.requests.start, { ...payload, website: "spam" }),
    ).rejects.toThrow("Unable");
    const d = new Date();
    d.setUTCDate(d.getUTCDate() + ((6 - d.getUTCDay() + 7) % 7 || 7));
    await expect(
      t.mutation(api.requests.start, {
        ...payload,
        kind: "appointment",
        preferredDate: d.toISOString().slice(0, 10),
        preferredTime: "morning",
      }),
    ).rejects.toThrow("weekday");
    for (let i = 0; i < 5; i++)
      await t.mutation(api.requests.start, {
        ...payload,
        submissionKey: `test-submission-key-123456789${i}`,
      });
    await expect(
      t.mutation(api.requests.start, {
        ...payload,
        submissionKey: "test-submission-key-1234567899",
      }),
    ).rejects.toThrow("Too many");
  });
  it("limits uploads and accepts only supported image files", async () => {
    const t = convexTest(schema, modules);
    const id = await t.mutation(api.requests.start, payload);
    const access = { id, submissionKey: payload.submissionKey };
    const bad = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "text/plain" })),
    );
    await expect(
      t.mutation(api.requests.attach, { ...access, storageId: bad }),
    ).rejects.toThrow("Photos must");
    const image = await t.run((ctx) =>
      ctx.storage.store(new Blob(["test"], { type: "image/png" })),
    );
    await t.mutation(api.requests.attach, { ...access, storageId: image });
    await t.mutation(api.requests.attach, { ...access, storageId: image });
    expect(await t.run(async (ctx) => (await ctx.db.get(id))!.photos)).toEqual([
      image,
    ]);
    for (let i = 0; i < 12; i++)
      await t.mutation(api.requests.uploadUrl, access);
    await expect(t.mutation(api.requests.uploadUrl, access)).rejects.toThrow(
      "unavailable",
    );
    await t.mutation(api.requests.finish, access);
    await expect(
      t.mutation(api.requests.attach, { ...access, storageId: image }),
    ).rejects.toThrow("Request not found");
  });
  it("publishes only available vehicles and removes sold vehicles from public results", async () => {
    const t = convexTest(schema, modules),
      staff = await admin(t);
    const data = {
      year: 2020,
      make: "Ford",
      model: "Transit",
      price: 22000,
      mileage: 60000,
      description: "Test listing",
      status: "draft" as const,
      photos: [],
    };
    const id = await staff.mutation(api.inventory.save, data);
    expect(await t.query(api.inventory.available, {})).toHaveLength(0);
    await staff.mutation(api.inventory.save, {
      ...data,
      id,
      status: "available",
    });
    expect(await t.query(api.inventory.available, {})).toHaveLength(1);
    await staff.mutation(api.inventory.save, { ...data, id, status: "sold" });
    expect(await t.query(api.inventory.available, {})).toHaveLength(0);
  });
});
