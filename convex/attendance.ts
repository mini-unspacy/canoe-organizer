import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const toggleAttendance = mutation({
  args: {
    paddlerId: v.string(),
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_paddler_event", (q) =>
        q.eq("paddlerId", args.paddlerId).eq("eventId", args.eventId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("attendance", {
        paddlerId: args.paddlerId,
        eventId: args.eventId,
        attending: true,
      });
    } else {
      await ctx.db.patch(existing._id, { attending: !existing.attending });
    }
  },
});

export const setAttendance = mutation({
  args: {
    paddlerId: v.string(),
    eventId: v.string(),
    attending: v.boolean(),
  },
  handler: async (ctx, args) => {
    const existing = await ctx.db
      .query("attendance")
      .withIndex("by_paddler_event", (q) =>
        q.eq("paddlerId", args.paddlerId).eq("eventId", args.eventId)
      )
      .unique();

    if (!existing) {
      await ctx.db.insert("attendance", {
        paddlerId: args.paddlerId,
        eventId: args.eventId,
        attending: args.attending,
      });
    } else {
      await ctx.db.patch(existing._id, { attending: args.attending });
    }
  },
});

export const getAttendanceForEvent = query({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const records = await ctx.db
      .query("attendance")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
    return records.filter((r) => r.attending);
  },
});

export const getAttendanceForPaddler = query({
  args: {
    paddlerId: v.string(),
  },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("attendance")
      .withIndex("by_paddler", (q) => q.eq("paddlerId", args.paddlerId))
      .collect();
  },
});
