import Google from "@auth/core/providers/google";
import { convexAuth, getAuthUserId } from "@convex-dev/auth/server";
import { query, mutation } from "./_generated/server";
import { v } from "convex/values";
import { customAlphabet } from "nanoid";

const nanoid = customAlphabet("abcdefghijklmnopqrstuvwxyz0123456789", 10);

export const { auth, signIn, signOut, store } = convexAuth({
  providers: [Google],
  callbacks: {
    async afterUserCreatedOrUpdated(ctx, { userId, existingUserId }) {
      if (!existingUserId) {
        // New user — check if they match a known admin email
        const user = await ctx.db.get(userId);
        const email = user?.email?.toLowerCase();

        // Admin emails that should auto-link to existing paddler profiles
        const ADMIN_EMAILS: Record<string, string> = {
          "ken.c.li@gmail.com": "admin",
        };

        if (email && email in ADMIN_EMAILS) {
          // Find existing paddler by name match (Ken Li)
          const paddlers = await ctx.db.query("paddlers").collect();
          const kenPaddler = paddlers.find(
            (p) => p.firstName === "Ken" && (p.lastName === "Li" || p.lastInitial === "L")
          );
          await ctx.db.patch(userId, {
            role: "admin",
            onboardingComplete: !!kenPaddler,
            ...(kenPaddler ? { paddlerId: kenPaddler.id } : {}),
          });
        } else {
          await ctx.db.patch(userId, {
            role: "normal",
            onboardingComplete: false,
          });
        }
      }
    },
  },
});

export const currentUser = query({
  args: {},
  handler: async (ctx) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) return null;
    return await ctx.db.get(userId);
  },
});

export const completeOnboarding = mutation({
  args: {
    firstName: v.string(),
    lastName: v.string(),
    gender: v.union(v.literal("kane"), v.literal("wahine")),
    phone: v.optional(v.string()),
  },
  handler: async (ctx, args) => {
    const userId = await getAuthUserId(ctx);
    if (!userId) throw new Error("Not authenticated");

    const user = await ctx.db.get(userId);
    if (!user) throw new Error("User not found");

    // Create paddler profile
    const paddlerId = nanoid();
    await ctx.db.insert("paddlers", {
      id: paddlerId,
      firstName: args.firstName,
      lastInitial: args.lastName[0] || "A",
      lastName: args.lastName,
      gender: args.gender,
      type: "casual",
      ability: 3,
      seatPreference: "000000",
    });

    // Update user with paddler link and complete onboarding
    await ctx.db.patch(userId, {
      paddlerId,
      onboardingComplete: true,
      ...(args.phone ? { phone: args.phone } : {}),
    });

    return { paddlerId };
  },
});

export const getAllUsers = query({
  args: {},
  handler: async (ctx) => {
    const users = await ctx.db.query("users").collect();
    return users
      .filter((u) => u.paddlerId)
      .map((u) => ({ email: u.email || "", paddlerId: u.paddlerId! }));
  },
});
