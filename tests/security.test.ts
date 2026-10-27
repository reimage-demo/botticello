import { beforeAll, describe, it, expect, vi } from "vitest";
import { convexTest } from "convex-test";
import { Scrypt } from "lucia";
import schema from "../convex/schema";
import { api, internal } from "../convex/_generated/api";
import { hashPassword, verifyPassword } from "../convex/lib/password";
import { seal, open } from "../convex/lib/crypto";
const modules = import.meta.glob("../convex/**/*.ts");
const password = "a-strong-test-password-2026";
beforeAll(() => {
  process.env.CUSTOMER_DATA_KEY = btoa("d".repeat(32));
  process.env.CUSTOMER_INDEX_KEY = btoa("i".repeat(32));
  process.env.ADMIN_PASSWORD_PEPPER = btoa("p".repeat(32));
});
async function account(t: ReturnType<typeof convexTest>, secret: string) {
  return t.run(async (ctx) => {
    const userId = await ctx.db.insert("users", { email: "staff@example.com" });
    const accountId = await ctx.db.insert("authAccounts", {
      userId,
      provider: "password",
      providerAccountId: "staff@example.com",
      secret,
    });
    await ctx.db.insert("admins", {
      userId,
      email: "staff@example.com",
      active: true,
    });
    return { userId, accountId };
  });
}
describe("security boundaries", () => {
  it("uses unique salts, a server-only pepper, and rejects tampered ciphertext", async () => {
    const first = await hashPassword(password),
      second = await hashPassword(password);
    expect(first).not.toBe(second);
    expect(first).not.toContain(password);
    expect(await verifyPassword(password, first)).toBe(true);
    expect(await verifyPassword("wrong", first)).toBe(false);
    process.env.ADMIN_PASSWORD_PEPPER = btoa("x".repeat(32));
    expect(await verifyPassword(password, first)).toBe(false);
    process.env.ADMIN_PASSWORD_PEPPER = btoa("p".repeat(32));
    const encrypted = await seal({ name: "Customer" }, "request:123");
    expect(await open(encrypted, "request:123")).toEqual({ name: "Customer" });
    await expect(open(encrypted, "request:other")).rejects.toThrow();
    const corrupted =
      encrypted.slice(0, 20) +
      (encrypted[20] === "A" ? "B" : "A") +
      encrypted.slice(21);
    await expect(open(corrupted, "request:123")).rejects.toThrow();
  });
  it("locks after five failures, blocks a correct password during lockout, and recovers after 30 minutes", async () => {
    const t = convexTest(schema, modules);
    const { accountId } = await account(t, await hashPassword(password));
    const login = (secret: string) =>
      t.mutation(internal.login.verify, {
        email: "staff@example.com",
        password: secret,
      });
    for (let i = 0; i < 5; i++) expect(await login("wrong")).toBeNull();
    const state = await t.run((ctx) =>
      ctx.db
        .query("loginAttempts")
        .withIndex("by_account", (q) => q.eq("accountId", accountId))
        .unique(),
    );
    expect(state!.failures).toBe(5);
    expect(state!.lockedUntil - Date.now()).toBeGreaterThan(29 * 60 * 1000);
    expect(await login(password)).toBeNull();
    await t.run((ctx) =>
      ctx.db.patch(state!._id, { lockedUntil: Date.now() - 1 }),
    );
    expect(await login(password)).toHaveProperty("userId");
    expect(
      await t.run((ctx) => ctx.db.query("loginAttempts").collect()),
    ).toHaveLength(0);
  });
  it("resets failures after a successful login", async () => {
    const t = convexTest(schema, modules);
    await account(t, await hashPassword(password));
    for (let i = 0; i < 4; i++)
      await t.mutation(internal.login.verify, {
        email: "staff@example.com",
        password: "wrong",
      });
    expect(
      await t.mutation(internal.login.verify, {
        email: "staff@example.com",
        password,
      }),
    ).not.toBeNull();
    await t.mutation(internal.login.verify, {
      email: "staff@example.com",
      password: "wrong",
    });
    expect(
      (await t.run((ctx) => ctx.db.query("loginAttempts").unique()))!.failures,
    ).toBe(1);
  });
  it("rejects expired and revoked sessions server-side", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await account(t, await hashPassword(password));
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 30 * 60 * 1000,
      }),
    );
    const staff = t.withIdentity({ subject: `${userId}|${sessionId}` });
    expect(await staff.query(api.admin.me, {})).toHaveProperty("expiresAt");
    await t.run((ctx) =>
      ctx.db.patch(sessionId, { expirationTime: Date.now() - 1 }),
    );
    await expect(staff.query(api.requests.list, {})).rejects.toThrow(
      "Session expired",
    );
    await t.run((ctx) => ctx.db.delete(sessionId));
    await expect(staff.query(api.requests.list, {})).rejects.toThrow(
      "Session expired",
    );
  });
  it("enforces the 30-minute maximum even on a formerly longer session", async () => {
    const t = convexTest(schema, modules);
    const { userId } = await account(t, await hashPassword(password));
    const sessionId = await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86400000,
      }),
    );
    const staff = t.withIdentity({ subject: `${userId}|${sessionId}` });
    const clock = vi
      .spyOn(Date, "now")
      .mockReturnValue(Date.now() + 31 * 60 * 1000);
    try {
      await expect(staff.query(api.requests.list, {})).rejects.toThrow(
        "Session expired",
      );
    } finally {
      clock.mockRestore();
    }
  });
  it("counts concurrent failures atomically", async () => {
    const t = convexTest(schema, modules);
    await account(t, await hashPassword(password));
    await Promise.all(
      Array.from({ length: 5 }, () =>
        t.mutation(internal.login.verify, {
          email: "staff@example.com",
          password: "wrong",
        }),
      ),
    );
    const attempt = await t.run((ctx) =>
      ctx.db.query("loginAttempts").unique(),
    );
    expect(attempt!.failures).toBe(5);
    expect(attempt!.lockedUntil).toBeGreaterThan(Date.now());
  });
  it("protects existing password verifiers, revokes old sessions, and upgrades on valid login", async () => {
    const t = convexTest(schema, modules);
    const legacy = await new Scrypt().hash(password);
    const { userId, accountId } = await account(t, legacy);
    await t.run((ctx) =>
      ctx.db.insert("authSessions", {
        userId,
        expirationTime: Date.now() + 86400000,
      }),
    );
    expect(
      await t.mutation(internal.securityMigration.hardenCredentials, {}),
    ).toMatchObject({ hardened: 1, revokedSessions: 1 });
    const sealed = (await t.run((ctx) => ctx.db.get(accountId)))!.secret!;
    expect(sealed.startsWith("legacy-sealed:v1:")).toBe(true);
    expect(sealed).not.toContain(legacy);
    expect(
      await t.mutation(internal.login.verify, {
        email: "staff@example.com",
        password,
      }),
    ).not.toBeNull();
    expect(
      (await t.run((ctx) => ctx.db.get(accountId)))!.secret!.startsWith(
        "pbkdf2-sha256:",
      ),
    ).toBe(true);
  });
  it("migrates existing customer records without retaining plaintext fields", async () => {
    const t = convexTest(schema, modules);
    const id = await t.run((ctx) =>
      ctx.db.insert("requests", {
        kind: "estimate",
        name: "Existing Customer",
        email: "existing@example.com",
        phone: "8605550100",
        vehicle: "Truck",
        duty: "heavy",
        service: "Brakes",
        description: "Old request",
        status: "new",
        submissionKey: "existing-submission-key-1234567890",
        submitted: true,
        photos: [],
        uploadCount: 0,
        notes: [{ text: "Private note", at: Date.now() }],
        createdAt: Date.now(),
        updatedAt: Date.now(),
      }),
    );
    expect(await t.action(internal.securityMigration.migrateOne, {})).toEqual({
      migrated: true,
    });
    const row = await t.run((ctx) => ctx.db.get(id));
    expect(row).toHaveProperty("encrypted");
    expect(JSON.stringify(row)).not.toContain("Existing Customer");
    expect(row).not.toHaveProperty("email");
    expect(await t.query(internal.securityMigration.audit, {})).toMatchObject({
      plaintextRequests: 0,
      encryptedRequests: 1,
    });
  });
});
