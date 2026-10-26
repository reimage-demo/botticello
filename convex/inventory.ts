import { mutation, query } from "./_generated/server";
import { v } from "convex/values";
import { listingFields } from "./schema";
import { requireAdmin, bounded, validatePhotos } from "./lib/admin";
export const available = query({
  args: {},
  handler: async (ctx) => {
    const rows = await ctx.db
      .query("inventory")
      .withIndex("by_status", (q) => q.eq("status", "available"))
      .order("desc")
      .take(100);
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        photoUrls: await Promise.all(
          r.photos.map((id) => ctx.storage.getUrl(id)),
        ),
      })),
    );
  },
});
export const list = query({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    const rows = await ctx.db.query("inventory").order("desc").take(500);
    return Promise.all(
      rows.map(async (r) => ({
        ...r,
        photoUrls: await Promise.all(
          r.photos.map((id) => ctx.storage.getUrl(id)),
        ),
      })),
    );
  },
});
export const uploadUrl = mutation({
  args: {},
  handler: async (ctx) => {
    await requireAdmin(ctx);
    return ctx.storage.generateUploadUrl();
  },
});
export const save = mutation({
  args: {
    id: v.optional(v.id("inventory")),
    ...listingFields,
    photos: v.array(v.id("_storage")),
  },
  handler: async (ctx, args) => {
    await requireAdmin(ctx);
    bounded(args.make, "Make", 60);
    bounded(args.model, "Model", 100);
    if (
      !Number.isInteger(args.year) ||
      args.year < 1900 ||
      args.year > new Date().getFullYear() + 2 ||
      !Number.isFinite(args.price) ||
      args.price < 0 ||
      !Number.isFinite(args.mileage) ||
      args.mileage < 0 ||
      args.description.length > 6000
    )
      throw new Error("Check the vehicle details.");
    await validatePhotos(ctx, args.photos);
    const { id, ...data } = args;
    if (id) {
      if (!(await ctx.db.get(id))) throw new Error("Vehicle not found.");
      await ctx.db.patch(id, { ...data, updatedAt: Date.now() });
      return id;
    }
    return ctx.db.insert("inventory", {
      ...data,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    });
  },
});
