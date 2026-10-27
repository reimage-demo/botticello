import { describe, it, expect, beforeAll } from "vitest";
import { convexTest } from "convex-test";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
beforeAll(() => {
  process.env.CUSTOMER_DATA_KEY = btoa("d".repeat(32));
  process.env.CUSTOMER_INDEX_KEY = btoa("i".repeat(32));
  process.env.ADMIN_PASSWORD_PEPPER = btoa("p".repeat(32));
});
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
    const sessionId = await ctx.db.insert("authSessions", {
      userId: id,
      expirationTime: Date.now() + 30 * 60 * 1000,
    });
    return { id, sessionId };
  });
  return t.withIdentity({ subject: `${userId.id}|${userId.sessionId}` });
}
describe("shop access and workflow", () => {
  it("blocks anonymous and unapproved access to customer records", async () => {
    const t = convexTest(schema, modules);
    await expect(t.query(api.requests.list, {})).rejects.toThrow(
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
    const stored = await t.run((ctx) => ctx.db.get(id));
    expect(JSON.stringify(stored)).not.toContain(payload.name);
    expect(JSON.stringify(stored)).not.toContain(payload.email);
    expect(JSON.stringify(stored)).not.toContain(payload.phone);
    expect(JSON.stringify(stored)).not.toContain("Call to schedule inspection");
    expect(stored).not.toHaveProperty("submissionKey");
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
  it("encrypts uploaded photos and requires an active admin session to read them", async () => {
    const t = convexTest(schema, modules),
      staff = await admin(t);
    const id = await t.mutation(api.requests.start, payload);
    const bytes = new Uint8Array([137, 80, 78, 71, 13, 10, 26, 10, 1, 2, 3, 4]);
    const headers = {
      "Content-Type": "image/png",
      "X-Request-Id": id,
      "X-Submission-Key": payload.submissionKey,
      "X-Photo-Slot": "0",
    };
    expect(
      (
        await t.fetch("/customer-photo", {
          method: "POST",
          headers,
          body: bytes,
        })
      ).status,
    ).toBe(200);
    expect(
      (
        await t.fetch("/customer-photo", {
          method: "POST",
          headers,
          body: bytes,
        })
      ).status,
    ).toBe(200);
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row!.photos).toHaveLength(1);
    if (!row || !("encrypted" in row)) throw Error("Not encrypted");
    const stored = await t.run(async (ctx) => {
      const blob = await ctx.storage.get(row.photos[0].storageId);
      return { type: blob!.type, bytes: await blob!.arrayBuffer() };
    });
    expect(stored.type).toBe("application/octet-stream");
    expect(new Uint8Array(stored.bytes)).not.toEqual(bytes);
    expect((await t.fetch(`/admin-photo?id=${id}&slot=0`)).status).toBe(403);
    const image = await staff.fetch(`/admin-photo?id=${id}&slot=0`);
    expect(image.status).toBe(200);
    expect(image.headers.get("Cache-Control")).toBe("no-store");
    expect(new Uint8Array(await image.arrayBuffer())).toEqual(bytes);
    expect(
      (
        await t.fetch("/customer-photo", {
          method: "POST",
          headers: {
            ...headers,
            "X-Submission-Key": "wrong",
            "X-Photo-Slot": "1",
          },
          body: bytes,
        })
      ).status,
    ).toBe(400);
    expect(
      (
        await t.fetch("/customer-photo", {
          method: "POST",
          headers: { ...headers, "X-Photo-Slot": "2" },
          body: new Uint8Array([1, 2, 3]),
        })
      ).status,
    ).toBe(400);
    for (let i = 0; i < 10; i++)
      await t.mutation(internal.requests.reservePhoto, {
        id,
        submissionKey: payload.submissionKey,
        slot: `retry-${i}`,
      });
    await expect(
      t.mutation(internal.requests.reservePhoto, {
        id,
        submissionKey: payload.submissionKey,
        slot: "last",
      }),
    ).rejects.toThrow("unavailable");
  });
});

describe("detailed online estimates", () => {
  it("retains vehicle and issue details through finalization for the admin", async () => {
    const t = convexTest(schema, modules),
      staff = await admin(t);
    const details = {
      vehicleYear: "2018",
      vehicleMake: "Ford",
      vehicleModel: "F-150",
      vin: "1FTFW1EF1EFA00001",
      mileage: "65000",
      issueArea: "Front of vehicle",
      issueType: "Unusual noise",
      severity: "Still driving, but there is a concern",
      preferredContactMethod: "email" as const,
      needsTow: true,
      needsRental: false,
    };
    const id = await t.mutation(api.requests.start, { ...payload, ...details });
    await t.mutation(api.requests.finish, {
      id,
      submissionKey: payload.submissionKey,
    });
    expect((await staff.query(api.requests.list, {}))[0]).toMatchObject(
      details,
    );
  });
  it("rejects malformed VINs, model years, and mileage", async () => {
    const t = convexTest(schema, modules);
    for (const vin of ["123", "1FTFW1EF1EFA0000I", "1FTFW1EF1EFA0000O"])
      await expect(
        t.mutation(api.requests.start, { ...payload, vin }),
      ).rejects.toThrow("VIN");
    await expect(
      t.mutation(api.requests.start, { ...payload, vehicleYear: "1800" }),
    ).rejects.toThrow("year");
    await expect(
      t.mutation(api.requests.start, { ...payload, mileage: "-100" }),
    ).rejects.toThrow("mileage");
  });
});
