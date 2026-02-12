import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from 'nanoid';

const nanoid = customAlphabet('abcdefghijklmnopqrstuvwxyz0123456789', 10);

export const getPaddlers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paddlers").collect();
  },
});

const kaneNames = [
  "James", "Robert", "Michael", "William", "David", "Richard", "Joseph", "Thomas",
  "Charles", "Daniel", "Matthew", "Anthony", "Mark", "Donald", "Steven", "Paul",
  "Andrew", "Joshua", "Kevin", "Brian", "George", "Timothy", "Ronald", "Jason",
  "Edward", "Jeffrey", "Ryan", "Jacob", "Gary", "Nicholas", "Eric", "Jonathan",
  "Stephen", "Larry", "Justin", "Scott", "Brandon", "Benjamin", "Samuel", "Frank"
];

const wahineNames = [
  "Mary", "Patricia", "Jennifer", "Linda", "Elizabeth", "Barbara", "Susan", "Jessica",
  "Sarah", "Karen", "Lisa", "Nancy", "Betty", "Margaret", "Sandra", "Ashley",
  "Kimberly", "Emily", "Donna", "Michelle", "Dorothy", "Carol", "Amanda", "Melissa",
  "Deborah", "Stephanie", "Rebecca", "Laura", "Sharon", "Cynthia", "Kathleen", "Amy",
  "Shirley", "Angela", "Helen", "Anna", "Brenda", "Pamela", "Nicole", "Emma"
];

const lastInitials = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");

const lastNames = [
  "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", 
  "Rodriguez", "Martinez", "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", 
  "Thomas", "Taylor", "Moore", "Jackson", "Martin", "Lee", "Perez", "Thompson",
  "White", "Harris", "Sanchez", "Clark", "Ramirez", "Lewis", "Robinson", "Walker",
  "Young", "Allen", "King", "Wright", "Scott", "Torres", "Nguyen", "Hill", "Flores"
];

function shuffle<T>(array: T[]): T[] {
  const arr = [...array];
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function getRandomSeatPreference(): string {
  // Generate a 6-digit string representing seat preferences
  // e.g., "612000" means prefers seat 6, then 1, then 2, then no preference
  const seats = [1, 2, 3, 4, 5, 6];
  const shuffled = shuffle(seats);
  // Take 0-3 preferences, fill rest with zeros
  const numPrefs = Math.floor(Math.random() * 4); // 0-3 preferences
  const prefs = shuffled.slice(0, numPrefs);
  return [...prefs, ...Array(6 - prefs.length).fill(0)].join('');
}

export const populateSamplePaddlers = mutation({
  args: {},
  handler: async (ctx) => {
    const existingPaddlers = await ctx.db.query("paddlers").collect();
    if (existingPaddlers.length > 0) {
      console.log("Paddlers already exist. Skipping sample data population.");
      return { message: "Paddlers already exist." };
    }

    // Generate 20 kane and 20 wahine
    const paddlers: Array<{
      firstName: string;
      lastInitial: string;
      lastName?: string;
      gender: "kane" | "wahine";
      type: "racer" | "casual" | "very-casual";
      seatPreference?: string;
      ability: number;
    }> = [];

    // 20 Kane paddlers
    const kaneShuffled = shuffle(kaneNames).slice(0, 20);
    const lastNamesShuffled = shuffle(lastNames);
    for (let i = 0; i < 20; i++) {
      const ability = Math.floor(Math.random() * 5) + 1;
      const lastName = lastNamesShuffled[i % lastNamesShuffled.length];
      paddlers.push({
        firstName: kaneShuffled[i],
        lastInitial: lastName[0],
        lastName: lastName,
        gender: "kane",
        type: Math.random() > 0.6 ? "racer" : Math.random() > 0.5 ? "casual" : "very-casual",
        seatPreference: getRandomSeatPreference(),
        ability
      });
    }

    // 20 Wahine paddlers
    const wahineShuffled = shuffle(wahineNames).slice(0, 20);
    const lastNamesShuffled2 = shuffle(lastNames);
    for (let i = 0; i < 20; i++) {
      const ability = Math.floor(Math.random() * 5) + 1;
      const lastName = lastNamesShuffled2[i % lastNamesShuffled2.length];
      paddlers.push({
        firstName: wahineShuffled[i],
        lastInitial: lastName[0],
        lastName: lastName,
        gender: "wahine",
        type: Math.random() > 0.6 ? "racer" : Math.random() > 0.5 ? "casual" : "very-casual",
        seatPreference: getRandomSeatPreference(),
        ability
      });
    }

    await Promise.all(paddlers.map(async (p) => {
      await ctx.db.insert("paddlers", { ...p, id: nanoid() });
    }));

    return { message: `Populated ${paddlers.length} sample paddlers (20 Kane, 20 Wahine).` };
  },
});

export const addPaddler = mutation({
  args: {
    firstName: v.string(),
    lastName: v.optional(v.string()),
    gender: v.union(v.literal("kane"), v.literal("wahine")),
    type: v.union(v.literal("racer"), v.literal("casual"), v.literal("very-casual")),
    ability: v.number(),
    seatPreference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const id = nanoid();
    await ctx.db.insert("paddlers", {
      id,
      firstName: args.firstName,
      lastInitial: args.lastName?.[0] || "A",
      lastName: args.lastName,
      gender: args.gender,
      type: args.type,
      ability: args.ability,
      seatPreference: args.seatPreference || "000000",
    });
    return { success: true, id };
  },
});

export const migrateRecToCasual = mutation({
  args: {},
  handler: async (ctx) => {
    const paddlers = await ctx.db.query("paddlers").collect();
    const recPaddlers = paddlers.filter(p => p.type === "rec");
    for (const p of recPaddlers) {
      await ctx.db.patch(p._id, { type: "casual" });
    }
    return { message: `Migrated ${recPaddlers.length} paddlers from "rec" to "casual".` };
  },
});

export const clearAllPaddlers = mutation({
  args: {},
  handler: async (ctx) => {
    const paddlers = await ctx.db.query("paddlers").collect();
    await Promise.all(paddlers.map(p => ctx.db.delete(p._id)));
    return { message: `Deleted ${paddlers.length} paddlers.` };
  },
});

export const deletePaddler = mutation({
  args: {
    paddlerId: v.string(),
  },
  handler: async (ctx, args) => {
    const paddlerDoc = await ctx.db.query("paddlers").withIndex("by_paddler_id", (q) => q.eq("id", args.paddlerId)).unique();
    if (!paddlerDoc) {
      throw new Error("Paddler not found");
    }
    
    // If paddler is assigned to a canoe, unassign them first
    if (paddlerDoc.assignedCanoe && paddlerDoc.assignedSeat) {
      const canoeDoc = await ctx.db.query("canoes").withIndex("by_canoe_id", (q) => q.eq("id", paddlerDoc.assignedCanoe!)).unique();
      if (canoeDoc) {
        const updatedAssignments = canoeDoc.assignments.filter(a => !(a.seat === paddlerDoc.assignedSeat && a.paddlerId === args.paddlerId));
        await ctx.db.patch(canoeDoc._id, {
          assignments: updatedAssignments,
          status: updatedAssignments.length < 6 ? "open" : canoeDoc.status,
        });
      }
    }
    
    // Delete the paddler
    await ctx.db.delete(paddlerDoc._id);
    return { success: true, message: `Deleted paddler ${paddlerDoc.firstName}` };
  },
});

export const updatePaddler = mutation({
  args: {
    paddlerId: v.string(),
    firstName: v.optional(v.string()),
    lastName: v.optional(v.string()),
    gender: v.optional(v.union(v.literal("kane"), v.literal("wahine"))),
    type: v.optional(v.union(v.literal("racer"), v.literal("casual"), v.literal("very-casual"))),
    ability: v.optional(v.number()),
    seatPreference: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const paddlerDoc = await ctx.db.query("paddlers").withIndex("by_paddler_id", (q) => q.eq("id", args.paddlerId)).unique();
    if (!paddlerDoc) {
      throw new Error("Paddler not found");
    }
    
    const updates: Record<string, unknown> = {};
    if (args.firstName !== undefined) updates.firstName = args.firstName;
    if (args.lastName !== undefined) {
      updates.lastName = args.lastName;
      updates.lastInitial = args.lastName[0] || "A";
    }
    if (args.gender !== undefined) updates.gender = args.gender;
    if (args.type !== undefined) updates.type = args.type;
    if (args.ability !== undefined) updates.ability = args.ability;
    if (args.seatPreference !== undefined) updates.seatPreference = args.seatPreference;
    
    await ctx.db.patch(paddlerDoc._id, updates);
    return { success: true, message: `Updated paddler ${args.firstName || paddlerDoc.firstName}` };
  },
});
