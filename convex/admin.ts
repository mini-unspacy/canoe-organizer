import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

export const clearAllData = mutation({
  args: {},
  handler: async (ctx) => {
    const paddlers = await ctx.db.query("paddlers").collect();
    const canoes = await ctx.db.query("canoes").collect();
    
    await Promise.all(paddlers.map(p => ctx.db.delete(p._id)));
    await Promise.all(canoes.map(c => ctx.db.delete(c._id)));
    
    return { message: `Cleared ${paddlers.length} paddlers and ${canoes.length} canoes.` };
  },
});

export const getAllPaddlers = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("paddlers").collect();
  },
});
