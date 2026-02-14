import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

function formatDate(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function parseEndDate(repeatUntil: string): Date {
  // "YYYY-MM-DD" → that date, or "YYYY-MM" → last day of that month
  const parts = repeatUntil.split("-").map(Number);
  if (parts.length >= 3) {
    return new Date(parts[0], parts[1] - 1, parts[2]);
  }
  return new Date(parts[0], parts[1], 0); // day 0 of next month = last day of this month
}

export const getEvents = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("events").withIndex("by_date").collect();
  },
});

export const addEvent = mutation({
  args: {
    title: v.string(),
    date: v.string(),
    time: v.string(),
    location: v.string(),
    eventType: v.optional(v.union(v.literal("practice"), v.literal("race"), v.literal("other"))),
    repeating: v.union(v.literal("none"), v.literal("weekly"), v.literal("monthly")),
    weekdays: v.optional(v.array(v.number())),
    monthdays: v.optional(v.array(v.number())),
    repeatUntil: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    if (args.repeating === "none") {
      const id = nanoid();
      await ctx.db.insert("events", {
        id,
        title: args.title,
        date: args.date,
        time: args.time,
        location: args.location,
        eventType: args.eventType,
        repeating: "none",
      });
      return { success: true, id };
    }

    const seriesId = nanoid();
    const endDate = args.repeatUntil
      ? parseEndDate(args.repeatUntil)
      : (() => { const d = new Date(args.date + "T00:00:00"); d.setMonth(d.getMonth() + 6); return d; })();
    const dates: string[] = [];

    if (args.repeating === "weekly") {
      const weekdays = args.weekdays && args.weekdays.length > 0 ? args.weekdays : [new Date(args.date + "T00:00:00").getDay()];
      // Start from today or the provided date, whichever is earlier
      const start = new Date(args.date + "T00:00:00");
      const current = new Date(start);
      while (current <= endDate) {
        if (weekdays.includes(current.getDay())) {
          dates.push(formatDate(current));
        }
        current.setDate(current.getDate() + 1);
      }
    } else if (args.repeating === "monthly") {
      const monthdays = args.monthdays && args.monthdays.length > 0 ? args.monthdays : [new Date(args.date + "T00:00:00").getDate()];
      const start = new Date(args.date + "T00:00:00");
      let currentMonth = start.getMonth();
      let currentYear = start.getFullYear();
      while (true) {
        for (const day of monthdays) {
          // Check if this day exists in the month
          const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
          if (day <= daysInMonth) {
            const d = new Date(currentYear, currentMonth, day);
            if (d >= start && d <= endDate) {
              dates.push(formatDate(d));
            }
          }
        }
        currentMonth++;
        if (currentMonth > 11) { currentMonth = 0; currentYear++; }
        if (new Date(currentYear, currentMonth, 1) > endDate) break;
      }
      dates.sort();
    }

    const ids: string[] = [];
    for (const date of dates) {
      const id = nanoid();
      ids.push(id);
      await ctx.db.insert("events", {
        id,
        title: args.title,
        date,
        time: args.time,
        location: args.location,
        eventType: args.eventType,
        repeating: args.repeating,
        weekdays: args.weekdays,
        monthdays: args.monthdays,
        repeatUntil: args.repeatUntil,
        seriesId,
      });
    }

    return { success: true, ids };
  },
});

export const updateEvent = mutation({
  args: {
    eventId: v.string(),
    title: v.optional(v.string()),
    date: v.optional(v.string()),
    time: v.optional(v.string()),
    location: v.optional(v.string()),
    eventType: v.optional(v.union(v.literal("practice"), v.literal("race"), v.literal("other"))),
    repeating: v.optional(v.union(v.literal("none"), v.literal("weekly"), v.literal("monthly"))),
  },
  handler: async (ctx, args) => {
    const eventDoc = await ctx.db.query("events").withIndex("by_event_id", (q) => q.eq("id", args.eventId)).unique();
    if (!eventDoc) {
      throw new Error("Event not found");
    }

    const updates: Record<string, unknown> = {};
    if (args.title !== undefined) updates.title = args.title;
    if (args.date !== undefined) updates.date = args.date;
    if (args.time !== undefined) updates.time = args.time;
    if (args.location !== undefined) updates.location = args.location;
    if (args.eventType !== undefined) updates.eventType = args.eventType;
    if (args.repeating !== undefined) updates.repeating = args.repeating;

    await ctx.db.patch(eventDoc._id, updates);
    return { success: true };
  },
});

export const deleteEvent = mutation({
  args: {
    eventId: v.string(),
  },
  handler: async (ctx, args) => {
    const eventDoc = await ctx.db.query("events").withIndex("by_event_id", (q) => q.eq("id", args.eventId)).unique();
    if (!eventDoc) {
      throw new Error("Event not found");
    }
    await ctx.db.delete(eventDoc._id);
    return { success: true };
  },
});

export const migrateEventTypes = mutation({
  args: {},
  handler: async (ctx) => {
    const events = await ctx.db.query("events").collect();
    let count = 0;
    for (const event of events) {
      if (!event.eventType) {
        await ctx.db.patch(event._id, { eventType: "practice" });
        count++;
      }
    }
    return { success: true, updated: count };
  },
});
