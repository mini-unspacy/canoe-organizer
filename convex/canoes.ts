import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export const getCanoes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("canoes").collect();
  },
});

export const assignOptimal = mutation({
  args: {
    priority: v.optional(v.array(v.object({
      id: v.union(v.literal("ability"), v.literal("gender"), v.literal("type"), v.literal("seatPreference")),
      label: v.string(),
      gradient: v.string(),
      icon: v.string(),
    })))
  },
  handler: async (ctx, args) => {
    // Implementation of assignOptimal - uses priority if provided
    let paddlers = await ctx.db.query("paddlers").collect();
    let canoes = await ctx.db.query("canoes").collect();

    // Clear previous assignments for all paddlers and canoes
    await Promise.all(paddlers.map((paddler) =>
      ctx.db.patch(paddler._id, { assignedCanoe: undefined, assignedSeat: undefined })
    ));
    await Promise.all(canoes.map((canoe) =>
      ctx.db.patch(canoe._id, { assignments: [], status: "open" })
    ));

    // Sort paddlers by priority if provided, otherwise by ability
    if (args.priority && args.priority.length > 0) {
      paddlers.sort((a, b) => {
        for (const p of args.priority!) {
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
            case "seatPreference":
              const getPref = (pref: string | undefined) => {
                if (!pref) return 999;
                const seats = pref.split('').map(Number).filter(n => n >= 1 && n <= 6);
                return seats.length > 0 ? seats[0] : 999;
              };
              comparison = getPref(a.seatPreference) - getPref(b.seatPreference);
              break;
          }
          if (comparison !== 0) return comparison;
        }
        return 0;
      });
    } else {
      // Default: sort by ability
      paddlers.sort((a, b) => b.ability - a.ability);
    }

    // Assign paddlers to canoes following the priority order
    // Distribute evenly: fill seat 1 of all canoes, then seat 2, etc.
    let paddlerIndex = 0;
    const totalPaddlers = paddlers.length;
    const totalCanoes = canoes.length;
    const totalSeats = totalCanoes * 6;
    
    // Initialize assignments for all canoes
    const canoeAssignments: { [canoeId: string]: { seat: number; paddlerId: string }[] } = {};
    for (const canoe of canoes) {
      canoeAssignments[canoe._id.toString()] = [];
    }

    // Round-robin distribution: fill all seat 1s, then all seat 2s, etc.
    for (let seat = 1; seat <= 6 && paddlerIndex < totalPaddlers; seat++) {
      for (const canoe of canoes) {
        if (paddlerIndex >= totalPaddlers) break;
        
        const paddlerToAssign = paddlers[paddlerIndex++];
        canoeAssignments[canoe._id.toString()].push({ seat, paddlerId: paddlerToAssign.id });
        
        // Update paddler's assignedCanoe and assignedSeat
        await ctx.db.patch(paddlerToAssign._id, {
          assignedCanoe: canoe.id,
          assignedSeat: seat,
        });
      }
    }

    // Update all canoe assignments
    for (const canoe of canoes) {
      const assignments = canoeAssignments[canoe._id.toString()];
      await ctx.db.patch(canoe._id, {
        assignments,
        status: assignments.length === 6 ? "full" : "open",
      });
    }

    return { success: true, message: "Paddlers assigned optimally." };
  }
});

export const assignPaddlerToSeat = mutation({
  args: {
    paddlerId: v.string(),
    canoeId: v.string(),
    seat: v.number(),
    oldCanoeId: v.optional(v.string()), // Used for swapping or reassigning
    oldSeat: v.optional(v.number()),
  },
  handler: async (ctx, args) => {
    const { paddlerId, canoeId, seat, oldCanoeId, oldSeat } = args;

    const paddlerDoc = await ctx.db.query("paddlers").withIndex("by_paddler_id", (q) => q.eq("id", paddlerId)).unique();
    if (!paddlerDoc) {
      throw new Error("Paddler not found");
    }

    const newCanoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", canoeId)).unique();
    if (!newCanoeDoc) {
      throw new Error("New canoe not found");
    }

    // Remove paddler from old assignment if exists
    if (oldCanoeId && oldSeat) {
      const oldCanoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", oldCanoeId)).unique();
      if (oldCanoeDoc) {
        const updatedAssignments = oldCanoeDoc.assignments.filter(a => !(a.seat === oldSeat && a.paddlerId === paddlerId));
        await ctx.db.patch(oldCanoeDoc._id, { assignments: updatedAssignments });
      }
    }

    // Add paddler to new assignment
    const existingAssignmentForSeat = newCanoeDoc.assignments.find(a => a.seat === seat);
    let updatedNewCanoeAssignments = newCanoeDoc.assignments.filter(a => a.seat !== seat); // Remove existing assignment for this seat
    updatedNewCanoeAssignments.push({ seat, paddlerId });

    await ctx.db.patch(newCanoeDoc._id, {
      assignments: updatedNewCanoeAssignments,
      status: updatedNewCanoeAssignments.length === 6 ? "full" : newCanoeDoc.status,
    });

    // Update paddler's assignment
    await ctx.db.patch(paddlerDoc._id, {
      assignedCanoe: canoeId,
      assignedSeat: seat,
    });

    return { success: true };
  },
});

export const unassignPaddler = mutation({
  args: {
    paddlerId: v.string(),
    canoeId: v.string(), // The canoe they are being unassigned from
    seat: v.number(),   // The seat they are being unassigned from
  },
  handler: async (ctx, args) => {
    const { paddlerId, canoeId, seat } = args;

    const paddlerDoc = await ctx.db.query("paddlers").withIndex("by_paddler_id", (q) => q.eq("id", paddlerId)).unique();
    if (!paddlerDoc) {
      throw new Error("Paddler not found");
    }

    const canoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", canoeId)).unique();
    if (!canoeDoc) {
      throw new Error("Canoe not found");
    }

    // Remove paddler from canoe assignments
    const updatedAssignments = canoeDoc.assignments.filter(a => !(a.seat === seat && a.paddlerId === paddlerId));
    await ctx.db.patch(canoeDoc._id, {
      assignments: updatedAssignments,
      status: updatedAssignments.length < 6 ? "open" : canoeDoc.status,
    });

    // Clear paddler's assignment
    await ctx.db.patch(paddlerDoc._id, {
      assignedCanoe: undefined,
      assignedSeat: undefined,
    });

    return { success: true };
  },
});

export const populateSampleCanoes = mutation({
  args: {},
  handler: async (ctx) => {
    const existingCanoes = await ctx.db.query("canoes").collect();
    if (existingCanoes.length > 0) {
      console.log("Canoes already exist. Skipping sample data population.");
      return { message: "Canoes already exist." };
    }

    const sampleCanoeNames = ["Canoe 1", "Canoe 2", "Canoe 3", "Canoe 4"];

    await Promise.all(sampleCanoeNames.map(async (name, index) => {
      await ctx.db.insert("canoes", {
        id: nanoid(),
        name: name,
        assignments: [],
        status: "open",
      });
    }));

    return { message: `Populated ${sampleCanoeNames.length} sample canoes.` };
  },
});

export const clearAllCanoes = mutation({
  args: {},
  handler: async (ctx) => {
    const canoes = await ctx.db.query("canoes").collect();
    await Promise.all(canoes.map(c => ctx.db.delete(c._id)));
    return { message: `Deleted ${canoes.length} canoes.` };
  },
});

export const addCanoe = mutation({
  args: {
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const id = nanoid();
    await ctx.db.insert("canoes", {
      id,
      name: args.name,
      assignments: [],
      status: "open",
    });
    return { success: true, id, name: args.name };
  },
});

export const removeCanoe = mutation({
  args: {
    canoeId: v.string(),
  },
  handler: async (ctx, args) => {
    const canoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", args.canoeId)).unique();
    if (!canoeDoc) {
      throw new Error("Canoe not found");
    }

    // Unassign all paddlers from this canoe
    for (const assignment of canoeDoc.assignments) {
      const paddlerDoc = await ctx.db.query("paddlers").withIndex("by_paddler_id", (q) => q.eq("id", assignment.paddlerId)).unique();
      if (paddlerDoc) {
        await ctx.db.patch(paddlerDoc._id, {
          assignedCanoe: undefined,
          assignedSeat: undefined,
        });
      }
    }

    // Delete the canoe
    await ctx.db.delete(canoeDoc._id);
    return { success: true, message: `Removed canoe ${canoeDoc.name}` };
  },
});
