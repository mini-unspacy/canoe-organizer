import { defineSchema, defineTable } from "convex/server";
import { v } from "convex/values";
import { authTables } from "@convex-dev/auth/server";

export default defineSchema({
  ...authTables,

  // Override default users table with custom fields
  users: defineTable({
    // Auth.js default fields
    name: v.optional(v.string()),
    image: v.optional(v.string()),
    email: v.optional(v.string()),
    emailVerificationTime: v.optional(v.number()),
    phone: v.optional(v.string()),
    phoneVerificationTime: v.optional(v.number()),
    isAnonymous: v.optional(v.boolean()),
    // Custom fields
    role: v.optional(v.union(v.literal("admin"), v.literal("normal"))),
    paddlerId: v.optional(v.string()),
    onboardingComplete: v.optional(v.boolean()),
  })
    .index("email", ["email"])
    .index("by_paddlerId", ["paddlerId"]),

  paddlers: defineTable({
    id: v.string(),
    firstName: v.string(),
    lastInitial: v.string(),
    lastName: v.optional(v.string()),
    gender: v.union(v.literal("kane"), v.literal("wahine")),
    type: v.union(v.literal("racer"), v.literal("casual"), v.literal("very-casual")),
    seatPreference: v.optional(v.string()),
    preferredSeats: v.optional(v.array(v.number())),
    ability: v.number(),
    assignedCanoe: v.optional(v.string()),
    assignedSeat: v.optional(v.number())
  })
    .index("by_paddler_id", ["id"])
    .index("by_assignedCanoe", ["assignedCanoe"]),

  canoes: defineTable({
    id: v.string(),
    name: v.string(),
    designation: v.optional(v.string()),
    assignments: v.array(v.object({
      seat: v.number(),
      paddlerId: v.string()
    })),
    status: v.string()
  })
    .index("by_canoe_id", ["id"]),

  attendance: defineTable({
    paddlerId: v.string(),
    eventId: v.string(),
    attending: v.boolean(),
  })
    .index("by_paddler_event", ["paddlerId", "eventId"])
    .index("by_paddler", ["paddlerId"])
    .index("by_event", ["eventId"]),

  eventAssignments: defineTable({
    eventId: v.string(),
    canoeId: v.string(),
    seat: v.number(),
    paddlerId: v.string(),
  })
    .index("by_event", ["eventId"])
    .index("by_event_canoe", ["eventId", "canoeId"])
    .index("by_event_paddler", ["eventId", "paddlerId"]),

  events: defineTable({
    id: v.string(),
    title: v.string(),
    date: v.string(),
    time: v.string(),
    location: v.string(),
    eventType: v.optional(v.union(v.literal("practice"), v.literal("race"), v.literal("other"))),
    repeating: v.union(v.literal("none"), v.literal("weekly"), v.literal("monthly")),
    weekdays: v.optional(v.array(v.number())),
    monthdays: v.optional(v.array(v.number())),
    repeatUntil: v.optional(v.string()),
    seriesId: v.optional(v.string()),
  })
    .index("by_event_id", ["id"])
    .index("by_date", ["date"]),
});
