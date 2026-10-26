import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { requestFields, requestStatus } from "./schema";
import { requireAdmin, bounded, validatePhotos } from "./lib/admin";
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
    const prior = await ctx.db
      .query("requests")
      .withIndex("by_key", (q) => q.eq("submissionKey", args.submissionKey))
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
    const recent = await ctx.db
      .query("requests")
      .withIndex("by_email", (q) => q.eq("email", email))
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
    const { website, ...data } = args;
    return await ctx.db.insert("requests", {
      ...data,
      name,
      email,
      phone,
      status: "new",
      submitted: false,
      photos: [],
      uploadCount: 0,
      notes: [],
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
export const uploadUrl = mutation({
  args: access,
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (
      !r ||
      r.submissionKey !== args.submissionKey ||
      r.submitted ||
      r.createdAt < Date.now() - 86400000 ||
      r.uploadCount >= 12
    )
      throw new Error("Photo upload is unavailable.");
    await ctx.db.patch(r._id, { uploadCount: r.uploadCount + 1 });
    return ctx.storage.generateUploadUrl();
  },
});
export const attach = mutation({
  args: { ...access, storageId: v.id("_storage") },
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r || r.submissionKey !== args.submissionKey || r.submitted)
      throw new Error("Request not found.");
    if (r.photos.includes(args.storageId)) return;
    await validatePhotos(ctx, [...r.photos, args.storageId]);
    await ctx.db.patch(r._id, { photos: [...r.photos, args.storageId] });
  },
});
export const finish = mutation({
  args: access,
  handler: async (ctx, args) => {
    const r = await ctx.db.get(args.id);
    if (!r || r.submissionKey !== args.submissionKey)
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
      rows.map(async ({ submissionKey, ...r }) => ({
        ...r,
        photoUrls: await Promise.all(
          r.photos.map((id) => ctx.storage.getUrl(id)),
        ),
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
    if (!r) throw new Error("Request not found.");
    if (
      args.quoteMin !== undefined &&
      (!Number.isFinite(args.quoteMin) || args.quoteMin < 0)
    )
      throw new Error("Invalid quote.");
    if (
      args.quoteMax !== undefined &&
      (!Number.isFinite(args.quoteMax) ||
        args.quoteMax < (args.quoteMin ?? r.quoteMin ?? 0))
    )
      throw new Error("Maximum must be at least the minimum.");
    const { id, note, ...patch } = args;
    await ctx.db.patch(id, {
      ...patch,
      notes: note?.trim()
        ? [...r.notes, { text: bounded(note, "Note", 2000), at: Date.now() }]
        : r.notes,
      updatedAt: Date.now(),
    });
  },
});
