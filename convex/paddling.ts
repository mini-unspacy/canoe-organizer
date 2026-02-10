import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { internal } from "./_generated/api";

export const getCanoes = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("canoes").collect();
  },
});

export const getPaddlers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paddlers").collect();
  },
});

export const assignOptimal = mutation({
  args: {},
  handler: async (ctx) => {
    const paddlers = await ctx.db.query("paddlers").collect();
    const canoes = await ctx.db.query("canoes").collect();

    // Reset assignments for a fresh optimal assignment (simplification for initial version)
    for (const paddler of paddlers) {
      if (paddler.assignedCanoe || paddler.assignedSeat) {
        await ctx.db.patch(paddler._id, { assignedCanoe: undefined, assignedSeat: undefined });
      }
    }
    for (const canoe of canoes) {
      if (canoe.assignments.length > 0) {
        await ctx.db.patch(canoe._id, { assignments: [] });
      }
    }

    const unassignedPaddlers = [...paddlers];
    const updatedCanoes = [...canoes];

    // Simple assignment logic for now: try to fill canoes with a gender balance
    // This is a placeholder for the more complex algorithm, focusing on getting data flow working.
    for (const canoe of updatedCanoes) {
      let kaneCount = 0;
      let wahineCount = 0;
      const canoeAssignments: { seat: number; paddlerId: string }[] = [];

      for (let seat = 1; seat <= 6; seat++) {
        const preferredPaddlerIndex = unassignedPaddlers.findIndex(p => p.preferredSeats.includes(seat));
        let selectedPaddler;

        if (preferredPaddlerIndex !== -1) {
          selectedPaddler = unassignedPaddlers[preferredPaddlerIndex];
          unassignedPaddlers.splice(preferredPaddlerIndex, 1);
        } else {
          // Fallback to simple gender balancing
          const targetGender = kaneCount <= wahineCount ? "kane" : "wahine";
          const paddlerIndex = unassignedPaddlers.findIndex(p => p.gender === targetGender);
          if (paddlerIndex !== -1) {
            selectedPaddler = unassignedPaddlers[paddlerIndex];
            unassignedPaddlers.splice(paddlerIndex, 1);
          } else if (unassignedPaddlers.length > 0) {
            // If no preferred or target gender, just pick the next available
            selectedPaddler = unassignedPaddlers.shift();
          }
        }
        
        if (selectedPaddler) {
          canoeAssignments.push({ seat, paddlerId: selectedPaddler._id });
          await ctx.db.patch(selectedPaddler._id, { assignedCanoe: canoe._id, assignedSeat: seat });
          if (selectedPaddler.gender === "kane") {
            kaneCount++;
          } else {
            wahineCount++;
          }
        } else {
          break; // No more paddlers to assign to this canoe
        }
      }

      await ctx.db.patch(canoe._id, { assignments: canoeAssignments, status: canoeAssignments.length === 6 ? "full" : "open" });
    }

    return { success: true };
  },
});
