import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";

export default defineSchema({
  paddlers: defineTable({
    id: v.string(),
    firstName: v.string(),
    lastInitial: v.string(),
    lastName: v.optional(v.string()),
    gender: v.union(v.literal("kane"), v.literal("wahine")),
    type: v.union(v.literal("racer"), v.literal("casual"), v.literal("very-casual")),
    seatPreference: v.optional(v.string()), // e.g., "612000" = prefers seat 6, then 1, then 2, then no preference
    preferredSeats: v.optional(v.array(v.number())), // DEPRECATED: old field for migration
    ability: v.number(), // 1-5 (red-green)
    assignedCanoe: v.optional(v.string()),
    assignedSeat: v.optional(v.number())
  })
    .index("by_paddler_id", ["id"])
    .index("by_assignedCanoe", ["assignedCanoe"]),

  canoes: defineTable({
    id: v.string(),
    name: v.string(), // "Canoe 1", "Canoe 2"
    assignments: v.array(v.object({
      seat: v.number(), // 1-6
      paddlerId: v.string()
    })),
    status: v.string() // "open", "full", "locked"
  })
    .index("by_canoe_id", ["id"]),
});
