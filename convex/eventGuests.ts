import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getByEvent = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eventGuests")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const addGuest = mutation({
  args: {
    eventId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    await ctx.db.insert("eventGuests", {
      eventId: args.eventId,
      name: args.name,
    });
  },
});

export const removeGuest = mutation({
  args: {
    guestId: v.id("eventGuests"),
  },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.guestId);
  },
});
