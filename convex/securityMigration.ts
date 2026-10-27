import {
  internalAction,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";
import { encryptBytes, fingerprint, seal, open } from "./lib/crypto";
export const next = internalQuery({
  args: {},
  handler: async (ctx) =>
    (await ctx.db.query("requests").collect()).find(
      (r) => !("encrypted" in r),
    ) ?? null,
});
export const commit = internalMutation({
  args: {
    id: v.id("requests"),
    updatedAt: v.number(),
    encrypted: v.string(),
    keyHash: v.string(),
    emailHash: v.string(),
    photos: v.array(
      v.object({
        storageId: v.id("_storage"),
        slot: v.string(),
        contentType: v.string(),
      }),
    ),
  },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r || "encrypted" in r || r.updatedAt !== args.updatedAt)
      throw new Error("Record changed. Retry migration.");
    await ctx.db.replace(args.id, {
      encrypted: args.encrypted,
      keyHash: args.keyHash,
      emailHash: args.emailHash,
      photos: args.photos,
      uploadCount: r.uploadCount,
      status: r.status,
      submitted: r.submitted,
      createdAt: r.createdAt,
      updatedAt: r.updatedAt,
    });
  },
});
export const migrateOne = internalAction({
  args: {},
  handler: async (ctx): Promise<{ migrated: boolean }> => {
    const r = await ctx.runQuery(internal.securityMigration.next, {});
    if (!r || "encrypted" in r) return { migrated: false };
    const {
      _id,
      _creationTime,
      status,
      submitted,
      submissionKey,
      photos,
      uploadCount,
      createdAt,
      updatedAt,
      ...data
    } = r;
    const encryptedPhotos: {
      storageId: import("./_generated/dataModel").Id<"_storage">;
      slot: string;
      contentType: string;
    }[] = [];
    try {
      for (let i = 0; i < photos.length; i++) {
        const file = await ctx.storage.get(photos[i]);
        if (!file) throw new Error("An existing photo is missing.");
        const slot = `migrated-${i}`,
          bytes = await encryptBytes(
            new Uint8Array(await file.arrayBuffer()),
            `photo:${_id}:${slot}`,
          );
        const storageId = await ctx.storage.store(
          new Blob([bytes], { type: "application/octet-stream" }),
        );
        encryptedPhotos.push({ storageId, slot, contentType: file.type });
      }
      await ctx.runMutation(internal.securityMigration.commit, {
        id: _id,
        updatedAt,
        encrypted: await seal(data, `request:${_id}`),
        keyHash: await fingerprint(submissionKey, "submission"),
        emailHash: await fingerprint(data.email, "email"),
        photos: encryptedPhotos,
      });
    } catch (error) {
      for (const p of encryptedPhotos) await ctx.storage.delete(p.storageId);
      throw error;
    }
    for (const id of photos) await ctx.storage.delete(id);
    return { migrated: true };
  },
});
export const hardenCredentials = internalMutation({
  args: {},
  handler: async (ctx) => {
    let hardened = 0;
    for (const account of await ctx.db.query("authAccounts").collect()) {
      if (
        account.provider !== "password" ||
        !account.secret ||
        account.secret.startsWith("pbkdf2-sha256:") ||
        account.secret.startsWith("legacy-sealed:")
      )
        continue;
      await ctx.db.patch(account._id, {
        secret: `legacy-sealed:${await seal(account.secret, "legacy-password:v1", "ADMIN_PASSWORD_PEPPER")}`,
      });
      hardened++;
    }
    // Retire previously issued long-lived sessions. Refresh tokens tied to them
    // cannot create new sessions, and every customer read checks the session row.
    const sessions = await ctx.db.query("authSessions").collect();
    for (const session of sessions) await ctx.db.delete(session._id);
    for (const token of await ctx.db.query("authRefreshTokens").collect())
      await ctx.db.delete(token._id);
    return { hardened, revokedSessions: sessions.length };
  },
});
export const audit = internalQuery({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db.query("requests").collect(),
      accounts = await ctx.db.query("authAccounts").collect();
    return {
      requests: rows.length,
      plaintextRequests: rows.filter((r) => !("encrypted" in r)).length,
      encryptedRequests: rows.filter((r) => "encrypted" in r).length,
      unprotectedPasswordVerifiers: accounts.filter(
        (a) =>
          a.provider === "password" &&
          a.secret &&
          !a.secret.startsWith("pbkdf2-sha256:") &&
          !a.secret.startsWith("legacy-sealed:"),
      ).length,
      pepperedPasswordVerifiers: accounts.filter(
        (a) =>
          a.provider === "password" && a.secret?.startsWith("pbkdf2-sha256:"),
      ).length,
      sealedLegacyVerifiers: accounts.filter(
        (a) =>
          a.provider === "password" && a.secret?.startsWith("legacy-sealed:"),
      ).length,
    };
  },
});

export const selfTest = internalMutation({
  args: {},
  handler: async () => {
    const sample = { value: "synthetic-security-check" };
    const encrypted = await seal(sample, "self-test");
    const decrypted = await open<typeof sample>(encrypted, "self-test");
    return {
      encryptionRoundTrip: decrypted.value === sample.value,
      plaintextNotStored: !encrypted.includes(sample.value),
    };
  },
});
