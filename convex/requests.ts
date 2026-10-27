import {
  mutation,
  query,
  internalMutation,
  internalQuery,
} from "./_generated/server";
import { v } from "convex/values";
import { requestFields, requestStatus } from "./schema";
import { requireAdmin, bounded } from "./lib/admin";
import { seal, open, fingerprint } from "./lib/crypto";
import type { Infer } from "convex/values";
import type { Doc } from "./_generated/dataModel";
const requestValidator = v.object(requestFields);
export type CustomerData = Infer<typeof requestValidator> & {
  notes: { text: string; at: number }[];
  quoteMin?: number;
  quoteMax?: number;
};
export async function customerData(r: Doc<"requests">) {
  if (!("encrypted" in r))
    throw new Error("Customer data migration is required.");
  return open<CustomerData>(r.encrypted, `request:${r._id}`);
}
const access = { id: v.id("requests"), submissionKey: v.string() };
export const start = mutation({
  args: {
    ...requestFields,
    submissionKey: v.string(),
    website: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.website) throw new Error("Unable to submit request.");
    if (!/^[a-zA-Z0-9_-]{24,100}$/.test(args.submissionKey))
      throw new Error("Invalid request key.");
    const keyHash = await fingerprint(args.submissionKey, "submission");
    const prior = await ctx.db
      .query("requests")
      .withIndex("by_key_hash", (q) => q.eq("keyHash", keyHash))
      .unique();
    if (prior) return prior._id;
    const name = bounded(args.name, "Name", 100),
      email = bounded(args.email, "Email", 200).toLowerCase(),
      phone = bounded(args.phone, "Phone", 30);
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ||
      phone.replace(/\D/g, "").length < 10
    )
      throw new Error("Enter a valid email and phone number.");
    bounded(args.vehicle, "Vehicle", 150);
    bounded(args.service, "Service", 100);
    if (args.description.length > 4000)
      throw new Error("Description is too long.");
    for (const [label, value, max] of [
      ["Year", args.vehicleYear, 4],
      ["Make", args.vehicleMake, 60],
      ["Model", args.vehicleModel, 80],
      ["Mileage", args.mileage, 12],
      ["Issue area", args.issueArea, 100],
      ["Issue type", args.issueType, 100],
      ["Severity", args.severity, 40],
    ] as const) {
      if (value) bounded(value, label, max);
    }
    if (
      args.vehicleYear &&
      (!/^\d{4}$/.test(args.vehicleYear) ||
        Number(args.vehicleYear) < 1900 ||
        Number(args.vehicleYear) > new Date().getFullYear() + 2)
    )
      throw new Error("Enter a valid vehicle year.");
    if (args.vin && !/^[A-HJ-NPR-Z0-9]{17}$/.test(args.vin))
      throw new Error(
        "VIN must contain 17 letters and numbers, excluding I, O, and Q.",
      );
    if (args.mileage && !/^\d{1,9}$/.test(args.mileage))
      throw new Error("Enter a valid mileage.");
    const emailHash = await fingerprint(email, "email");
    const recent = await ctx.db
      .query("requests")
      .withIndex("by_email_hash", (q) => q.eq("emailHash", emailHash))
      .order("desc")
      .take(6);
    if (recent.filter((r) => r.createdAt > Date.now() - 3600000).length >= 5)
      throw new Error("Too many requests. Please call the shop.");
    if (args.kind === "appointment") {
      const date = args.preferredDate ?? "";
      const today = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      }).format(new Date());
      const d = new Date(`${date}T12:00:00Z`);
      if (
        !/^\d{4}-\d{2}-\d{2}$/.test(date) ||
        !Number.isFinite(d.getTime()) ||
        d.toISOString().slice(0, 10) !== date ||
        date < today ||
        d.getTime() > Date.now() + 180 * 86400000 ||
        [0, 6].includes(d.getUTCDay())
      )
        throw new Error("Choose a weekday within the next six months.");
      if (!["morning", "afternoon"].includes(args.preferredTime ?? ""))
        throw new Error("Choose a preferred time.");
    }
    const { website, submissionKey, ...data } = args;
    const id = await ctx.db.insert("requests", {
      encrypted: "pending",
      keyHash,
      emailHash,
      status: "new",
      submitted: false,
      photos: [],
      uploadCount: 0,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
    await ctx.db.patch(id, {
      encrypted: await seal(
        { ...data, name, email, phone, notes: [] },
        `request:${id}`,
      ),
    });
    return id;
  },
});
export const reservePhoto = internalMutation({
  args: { ...access, slot: v.string() },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (
      !r ||
      !("encrypted" in r) ||
      r.keyHash !== (await fingerprint(args.submissionKey, "submission")) ||
      r.submitted ||
      r.createdAt < Date.now() - 86400000 ||
      !/^[-a-zA-Z0-9]{1,64}$/.test(args.slot)
    )
      throw new Error("Photo upload is unavailable.");
    const existing = r.photos.find((p) => p.slot === args.slot);
    if (existing) return { existing: true };
    if (r.uploadCount >= 12 || r.photos.length >= 6)
      throw new Error("Photo upload is unavailable.");
    await ctx.db.patch(r._id, { uploadCount: r.uploadCount + 1 });
    return { existing: false };
  },
});
export const commitPhoto = internalMutation({
  args: {
    ...access,
    slot: v.string(),
    storageId: v.id("_storage"),
    contentType: v.string(),
  },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (
      !r ||
      !("encrypted" in r) ||
      r.keyHash !== (await fingerprint(args.submissionKey, "submission")) ||
      r.submitted
    )
      throw new Error("Photo upload is unavailable.");
    if (r.photos.some((p) => p.slot === args.slot)) return false;
    if (r.photos.length >= 6) throw new Error("Use up to six photos.");
    await ctx.db.patch(r._id, {
      photos: [
        ...r.photos,
        {
          storageId: args.storageId,
          slot: args.slot,
          contentType: args.contentType,
        },
      ],
    });
    return true;
  },
});
export const photoAccess = internalQuery({
  args: { id: v.id("requests"), slot: v.string() },
  handler: async (ctx, { id, slot }) => {
    await requireAdmin(ctx);
    const r = await ctx.db.get(id);
    if (!r || !("encrypted" in r)) throw new Error("Photo not found.");
    const photo = r.photos.find((p) => p.slot === slot);
    if (!photo) throw new Error("Photo not found.");
    return photo;
  },
});
export const finish = mutation({
  args: access,
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (
      !r ||
      !("encrypted" in r) ||
      r.keyHash !== (await fingerprint(args.submissionKey, "submission"))
    )
      throw new Error("Request not found.");
    await ctx.db.patch(r._id, { submitted: true, updatedAt: Date.now() });
    return { reference: r._id.slice(-8).toUpperCase() };
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db
      .query("requests")
      .withIndex("by_submitted", (q) => q.eq("submitted", true))
      .order("desc")
      .take(500);
    return Promise.all(
      rows.map(async (r) => ({
        _id: r._id,
        createdAt: r.createdAt,
        updatedAt: r.updatedAt,
        status: r.status,
        ...(await customerData(r)),
        photoRefs:
          "encrypted" in r ? r.photos.map((p) => ({ slot: p.slot })) : [],
      })),
    );
  },
});
export const update = mutation({
  args: {
    id: v.id("requests"),
    status: requestStatus,
    note: v.optional(v.string()),
    quoteMin: v.optional(v.number()),
    quoteMax: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    const r = await ctx.db.get(args.id);
    if (!r || !("encrypted" in r)) throw new Error("Request not found.");
    const data = await customerData(r);
    if (
      args.quoteMin !== undefined &&
      (!Number.isFinite(args.quoteMin) || args.quoteMin < 0)
    )
      throw new Error("Invalid quote.");
    if (
      args.quoteMax !== undefined &&
      (!Number.isFinite(args.quoteMax) ||
        args.quoteMax < (args.quoteMin ?? data.quoteMin ?? 0))
    )
      throw new Error("Maximum must be at least the minimum.");
    const { id, note, status, quoteMin, quoteMax } = args;
    const next = {
      ...data,
      ...(quoteMin !== undefined ? { quoteMin } : {}),
      ...(quoteMax !== undefined ? { quoteMax } : {}),
      notes: note?.trim()
        ? [...data.notes, { text: bounded(note, "Note", 2000), at: Date.now() }]
        : data.notes,
    };
    await ctx.db.patch(id, {
      status,
      encrypted: await seal(next, `request:${id}`),
      updatedAt: Date.now(),
    });
  },
});
