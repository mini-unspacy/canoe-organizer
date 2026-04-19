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
    // Fill canoes sequentially: fill canoe 1 (seats 1-6), then canoe 2, etc.
    // This groups high-priority paddlers together in the first canoes
    let paddlerIndex = 0;
    const totalPaddlers = paddlers.length;
    
    // Initialize assignments for all canoes
    const canoeAssignments: { [canoeId: string]: { seat: number; paddlerId: string }[] } = {};
    for (const canoe of canoes) {
      canoeAssignments[canoe._id.toString()] = [];
    }

    // Sequential distribution: fill canoe 1 completely, then canoe 2, etc.
    for (const canoe of canoes) {
      if (paddlerIndex >= totalPaddlers) break;
      
      for (let seat = 1; seat <= 6 && paddlerIndex < totalPaddlers; seat++) {
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

    // Seed with canonical canoe #/name pairs so a fresh DB starts with four
    // real-looking boats. Mirrors the CANOE_NAME_BY_DESIGNATION map on the
    // frontend (kept in sync by hand; see frontend/src/utils.ts).
    const SEEDS: Array<{ designation: string; name: string }> = [
      { designation: "710", name: "Hōkūleʻa" },
      { designation: "711", name: "Puakea" },
      { designation: "700", name: "Kainalu" },
      { designation: "67",  name: "Mānele"  },
    ];

    await Promise.all(SEEDS.map(async ({ designation, name }) => {
      await ctx.db.insert("canoes", {
        id: nanoid(),
        name,
        designation,
        assignments: [],
        status: "open",
      });
    }));

    return { message: `Populated ${SEEDS.length} sample canoes.` };
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

    // Delete any per-event seat assignments that reference this canoe.
    // Without this, paddlers stay "assigned" to a now-deleted canoe and
    // don't return to the On Shore pool.
    const orphanedEventAssignments = await ctx.db
      .query("eventAssignments")
      .filter((q) => q.eq(q.field("canoeId"), args.canoeId))
      .collect();
    for (const ea of orphanedEventAssignments) {
      await ctx.db.delete(ea._id);
    }

    // Delete the canoe
    await ctx.db.delete(canoeDoc._id);
    return { success: true, message: `Removed canoe ${canoeDoc.name}` };
  },
});

export const updateDesignation = mutation({
  args: {
    canoeId: v.string(),
    designation: v.string(),
  },
  handler: async (ctx, args) => {
    const canoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", args.canoeId)).unique();
    if (!canoeDoc) throw new Error("Canoe not found");
    await ctx.db.patch(canoeDoc._id, { designation: args.designation });
    return { success: true };
  },
});

export const renameCanoe = mutation({
  args: {
    canoeId: v.string(),
    name: v.string(),
  },
  handler: async (ctx, args) => {
    const canoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", args.canoeId)).unique();
    if (!canoeDoc) throw new Error("Canoe not found");
    await ctx.db.patch(canoeDoc._id, { name: args.name });
    return { success: true, name: args.name };
  },
});

// One-shot maintenance mutation: rebrand the existing numeric test canoes with
// Hawaiian names and human-readable designations to match the Lokahi mock-up.
// The current dev DB stores the numeric tag in the `designation` field and a
// generic "Canoe N" in the `name` field; this mutation swaps them. Idempotent:
// only canoes whose current designation matches the mapping are touched, and
// only the first match per designation is renamed (so running twice is a no-op).
export const renameTestCanoesToHawaiian = mutation({
  args: {},
  handler: async (ctx) => {
    const mapping: Record<string, { name: string; designation: string }> = {
      "707": { name: "Pōkai",    designation: "Race 1" },
      "711": { name: "Puakea",   designation: "Race 2" },
      "710": { name: "Hōkūleʻa", designation: "Long Course" },
      "700": { name: "Kainalu",  designation: "Novice" },
      "67":  { name: "Mānele",   designation: "Race 3" },
    };
    const canoes = await ctx.db.query("canoes").collect();
    const claimed = new Set<string>();
    const renamed: string[] = [];
    const skipped: string[] = [];
    for (const c of canoes) {
      // Already rebranded (name is one of the Hawaiian targets)? Skip.
      const hawaiianTargets = new Set(Object.values(mapping).map(m => m.name));
      if (hawaiianTargets.has(c.name)) continue;
      const key = c.designation ?? "";
      const target = mapping[key];
      if (!target) continue;
      if (claimed.has(key)) {
        skipped.push(`${c.name} (${key}) — duplicate designation, skipped`);
        continue;
      }
      claimed.add(key);
      await ctx.db.patch(c._id, { name: target.name, designation: target.designation });
      renamed.push(`${c.name} (${key}) -> ${target.name} (${target.designation})`);
    }
    return { renamed, skipped, count: renamed.length };
  },
});

// One-shot utility: any canoe still named "Canoe N" (or just "Canoe") gets
// its name replaced. If the canoe already has a designation we know about,
// the canonical name for that # is used (710 → Hōkūleʻa etc.); otherwise
// the name is blanked so the admin can pick a # in the UI, which will then
// auto-populate the name. Idempotent.
export const normalizeNumericCanoeNames = mutation({
  args: {},
  handler: async (ctx) => {
    // Keep in sync with frontend/src/utils.ts CANOE_NAME_BY_DESIGNATION.
    const NAME_BY_DESIGNATION: Record<string, string> = {
      "57":  "Kaimana",
      "67":  "Mānele",
      "700": "Kainalu",
      "710": "Hōkūleʻa",
      "711": "Puakea",
      "M":   "Malia",
      "W":   "WAKA",
    };
    const numericPattern = /^Canoe(\s+\d+)?$/;
    const canoes = await ctx.db.query("canoes").collect();
    const renamed: string[] = [];
    for (const c of canoes) {
      if (!numericPattern.test(c.name.trim())) continue;
      const designation = (c.designation ?? "").trim();
      const next = NAME_BY_DESIGNATION[designation] ?? "";
      await ctx.db.patch(c._id, { name: next });
      renamed.push(`${c.name} -> ${next || "(blank)"}`);
    }
    return { renamed, count: renamed.length };
  },
});
