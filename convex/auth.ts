import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export const login = mutation({
  args: {
    email: v.string(),
    password: v.string(),
  },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) {
      return { error: "invalid email or password" };
    }
    if (user.password !== args.password) {
      return { error: "invalid email or password" };
    }
    return { email: user.email, role: user.role, paddlerId: user.paddlerId };
  },
});

export const getUser = query({
  args: { email: v.string() },
  handler: async (ctx, args) => {
    const user = await ctx.db
      .query("users")
      .withIndex("by_email", (q) => q.eq("email", args.email))
      .unique();
    if (!user) return null;
    return { email: user.email, role: user.role, paddlerId: user.paddlerId };
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users.map((u) => ({ email: u.email, paddlerId: u.paddlerId }));
  },
});

export const seedUsers = mutation({
  args: {},
  handler: async (ctx) => {
    // Check if users already exist
    const existing = await ctx.db.query("users").first();
    if (existing) {
      return { message: "users already seeded" };
    }

    const paddlers = await ctx.db.query("paddlers").collect();

    // Find or create Ken Li paddler
    let kenPaddler = paddlers.find(
      (p) => p.firstName === "Ken" && (p.lastName === "Li" || p.lastInitial === "L")
    );
    let kenPaddlerId: string;
    if (kenPaddler) {
      kenPaddlerId = kenPaddler.id;
    } else {
      kenPaddlerId = nanoid();
      await ctx.db.insert("paddlers", {
        id: kenPaddlerId,
        firstName: "Ken",
        lastInitial: "L",
        lastName: "Li",
        gender: "kane",
        type: "racer",
        ability: 5,
        seatPreference: "000000",
      });
    }

    // Create admin user for Ken Li
    await ctx.db.insert("users", {
      email: "ken.c.li@gmail.com",
      password: "12345",
      role: "admin",
      paddlerId: kenPaddlerId,
    });

    // Create normal users for all other paddlers
    const usedEmails = new Set<string>(["ken.c.li@gmail.com"]);

    for (const p of paddlers) {
      if (p.id === kenPaddlerId) continue;

      const first = p.firstName.toLowerCase().replace(/[^a-z]/g, "");
      const lastInit = (p.lastName?.[0] || p.lastInitial || "x").toLowerCase();
      let baseEmail = `${first}.${lastInit}@example.com`;
      let email = baseEmail;
      let suffix = 2;
      while (usedEmails.has(email)) {
        email = `${first}.${lastInit}${suffix}@example.com`;
        suffix++;
      }
      usedEmails.add(email);

      await ctx.db.insert("users", {
        email,
        password: "54321",
        role: "normal",
        paddlerId: p.id,
      });
    }

    return { message: "users seeded", count: usedEmails.size };
  },
});
