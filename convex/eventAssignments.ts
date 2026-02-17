import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const getEventAssignments = query({
  args: { eventId: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("eventAssignments")
      .withIndex("by_event", (q) => q.eq("eventId", args.eventId))
      .collect();
  },
});

export const assignPaddlerToSeat = mutation({
  args: {
    eventId: v.string(),
    paddlerId: v.string(),
    canoeId: v.string(),
    seat: v.number(),
  },
  handler: async (ctx, args) => {
    const { eventId, paddlerId, canoeId, seat } = args;

    // Remove any existing assignment for this paddler in this event
    const existingForPaddler = await ctx.db
      .query("eventAssignments")
      .withIndex("by_event_paddler", (q) =>
        q.eq("eventId", eventId).eq("paddlerId", paddlerId)
      )
      .collect();
    await Promise.all(existingForPaddler.map((a) => ctx.db.delete(a._id)));

    // Remove any existing occupant of that seat in that canoe for this event
    const existingForSeat = await ctx.db
      .query("eventAssignments")
      .withIndex("by_event_canoe", (q) =>
        q.eq("eventId", eventId).eq("canoeId", canoeId)
      )
      .collect();
    const occupant = existingForSeat.find((a) => a.seat === seat);
    if (occupant) {
      await ctx.db.delete(occupant._id);
    }

    // Insert new assignment
    await ctx.db.insert("eventAssignments", {
      eventId,
      canoeId,
      seat,
      paddlerId,
    });

    return { success: true };
  },
});

export const unassignPaddler = mutation({
  args: {
    eventId: v.string(),
    paddlerId: v.string(),
    canoeId: v.string(),
    seat: v.number(),
  },
  handler: async (ctx, args) => {
    const { eventId, paddlerId, canoeId, seat } = args;

    const assignments = await ctx.db
      .query("eventAssignments")
      .withIndex("by_event_canoe", (q) =>
        q.eq("eventId", eventId).eq("canoeId", canoeId)
      )
      .collect();
    const match = assignments.find(
      (a) => a.seat === seat && a.paddlerId === paddlerId
    );
    if (match) {
      await ctx.db.delete(match._id);
    }

    return { success: true };
  },
});

export const unassignAllForEvent = mutation({
  args: {
    eventId: v.string(),
    excludeCanoeIds: v.optional(v.array(v.string())),
  },
  handler: async (ctx, args) => {
    const { eventId, excludeCanoeIds } = args;
    const excludeSet = new Set(excludeCanoeIds || []);

    const assignments = await ctx.db
      .query("eventAssignments")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    await Promise.all(
      assignments
        .filter((a) => !excludeSet.has(a.canoeId))
        .map((a) => ctx.db.delete(a._id))
    );

    return { success: true };
  },
});

export const assignOptimalForEvent = mutation({
  args: {
    eventId: v.string(),
    priority: v.optional(
      v.array(
        v.object({
          id: v.union(
            v.literal("ability"),
            v.literal("gender"),
            v.literal("type"),
            v.literal("seatPreference")
          ),
          label: v.string(),
          gradient: v.string(),
          icon: v.string(),
        })
      )
    ),
    excludeCanoeIds: v.optional(v.array(v.string())),
    onlyReassignExisting: v.optional(v.boolean()),
  },
  handler: async (ctx, args) => {
    const { eventId, priority, excludeCanoeIds, onlyReassignExisting } = args;
    const excludeSet = new Set(excludeCanoeIds || []);

    // Get attending paddlers for this event
    const attendanceRecords = await ctx.db
      .query("attendance")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();
    const attendingPaddlerIds = new Set(
      attendanceRecords
        .filter((a) => a.attending)
        .map((a) => a.paddlerId)
    );

    const allPaddlers = await ctx.db.query("paddlers").collect();

    const canoes = await ctx.db.query("canoes").collect();

    // Get existing assignments for locked canoes (to preserve them)
    const existingAssignments = await ctx.db
      .query("eventAssignments")
      .withIndex("by_event", (q) => q.eq("eventId", eventId))
      .collect();

    // Paddlers already assigned to locked canoes — exclude from reassignment
    const lockedPaddlerIds = new Set(
      existingAssignments
        .filter((a) => excludeSet.has(a.canoeId))
        .map((a) => a.paddlerId)
    );

    let paddlers;
    if (onlyReassignExisting) {
      // Only re-sort paddlers already assigned to non-locked canoes
      const assignedToUnlockedIds = new Set(
        existingAssignments
          .filter((a) => !excludeSet.has(a.canoeId))
          .map((a) => a.paddlerId)
      );
      paddlers = allPaddlers.filter((p) => assignedToUnlockedIds.has(p.id));
    } else {
      paddlers = allPaddlers.filter((p) => attendingPaddlerIds.has(p.id));
      paddlers = paddlers.filter((p) => !lockedPaddlerIds.has(p.id));
    }

    // Clear non-locked assignments
    await Promise.all(
      existingAssignments
        .filter((a) => !excludeSet.has(a.canoeId))
        .map((a) => ctx.db.delete(a._id))
    );

    // Sort paddlers by priority (same logic as canoes.ts assignOptimal)
    if (priority && priority.length > 0) {
      paddlers.sort((a, b) => {
        for (const p of priority) {
          let comparison = 0;
          switch (p.id) {
            case "ability":
              comparison = b.ability - a.ability;
              break;
            case "gender":
              comparison = a.gender.localeCompare(b.gender);
              break;
            case "type":
              comparison = a.type.localeCompare(b.type);
              break;
            case "seatPreference": {
              const getPref = (pref: string | undefined) => {
                if (!pref) return 999;
                const seats = pref
                  .split("")
                  .map(Number)
                  .filter((n) => n >= 1 && n <= 6);
                return seats.length > 0 ? seats[0] : 999;
              };
              comparison = getPref(a.seatPreference) - getPref(b.seatPreference);
              break;
            }
          }
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    } else {
      paddlers.sort((a, b) => b.ability - a.ability);
    }

    // Fill non-locked canoes sequentially
    let paddlerIndex = 0;
    for (const canoe of canoes) {
      if (excludeSet.has(canoe.id)) continue;
      if (paddlerIndex >= paddlers.length) break;

      for (let seat = 1; seat <= 6 && paddlerIndex < paddlers.length; seat++) {
        const paddler = paddlers[paddlerIndex++];
        await ctx.db.insert("eventAssignments", {
          eventId,
          canoeId: canoe.id,
          seat,
          paddlerId: paddler.id,
        });
      }
    }

    return { success: true, message: "Paddlers assigned optimally for event." };
  },
});
