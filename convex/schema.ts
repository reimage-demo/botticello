import { defineSchema, defineTable } from "convex/server";
import { authTables } from "@convex-dev/auth/server";
import { v } from "convex/values";
export const requestStatus = v.union(
  v.literal("new"),
  v.literal("contacted"),
  v.literal("confirmed"),
  v.literal("in_progress"),
  v.literal("completed"),
  v.literal("cancelled"),
);
export const listingStatus = v.union(
  v.literal("draft"),
  v.literal("available"),
  v.literal("sold"),
  v.literal("archived"),
);
export const requestFields = {
  kind: v.union(v.literal("estimate"), v.literal("appointment")),
  name: v.string(),
  email: v.string(),
  phone: v.string(),
  vehicle: v.string(),
  duty: v.union(v.literal("light"), v.literal("medium"), v.literal("heavy")),
  service: v.string(),
  description: v.string(),
  preferredDate: v.optional(v.string()),
  preferredTime: v.optional(v.string()),
};
export const listingFields = {
  year: v.number(),
  make: v.string(),
  model: v.string(),
  price: v.number(),
  mileage: v.number(),
  description: v.string(),
  status: listingStatus,
};
export default defineSchema({
  ...authTables,
  admins: defineTable({
    userId: v.id("users"),
    email: v.string(),
    active: v.boolean(),
  }).index("by_user", ["userId"]),
  requests: defineTable({
    ...requestFields,
    status: requestStatus,
    submissionKey: v.string(),
    submitted: v.boolean(),
    photos: v.array(v.id("_storage")),
    uploadCount: v.number(),
    notes: v.array(v.object({ text: v.string(), at: v.number() })),
    quoteMin: v.optional(v.number()),
    quoteMax: v.optional(v.number()),
    createdAt: v.number(),
    updatedAt: v.number(),
  })
    .index("by_key", ["submissionKey"])
    .index("by_email", ["email"])
    .index("by_submitted", ["submitted"]),
  inventory: defineTable({
    ...listingFields,
    photos: v.array(v.id("_storage")),
    createdAt: v.number(),
    updatedAt: v.number(),
  }).index("by_status", ["status"]),
});
