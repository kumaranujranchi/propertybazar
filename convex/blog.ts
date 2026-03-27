import { query, mutation } from "./_generated/server";
import { v } from "convex/values";

// ---- PUBLIC QUERIES ----

/** Get all published posts (for public blog page) */
export const getPublishedPosts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db
      .query("blogPosts")
      .withIndex("by_status", (q) => q.eq("status", "published"))
      .order("desc")
      .collect();
  },
});

/** Get a single post by slug (for public blog-post page) */
export const getPostBySlug = query({
  args: { slug: v.string() },
  handler: async (ctx, args) => {
    return await ctx.db
      .query("blogPosts")
      .withIndex("by_slug", (q) => q.eq("slug", args.slug))
      .first();
  },
});

// ---- ADMIN QUERIES ----

/** Get ALL posts including drafts (for admin CMS) */
export const getAllPosts = query({
  args: {},
  handler: async (ctx) => {
    return await ctx.db.query("blogPosts").order("desc").collect();
  },
});

/** Get a single post by ID (for admin edit form) */
export const getPostById = query({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    return await ctx.db.get(args.id);
  },
});

// ---- MUTATIONS ----

/** Create a new blog post */
export const createPost = mutation({
  args: {
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const publishedAt = args.status === "published" ? Date.now() : undefined;
    return await ctx.db.insert("blogPosts", {
      ...args,
      publishedAt,
    });
  },
});

/** Update an existing blog post */
export const updatePost = mutation({
  args: {
    id: v.id("blogPosts"),
    title: v.string(),
    slug: v.string(),
    content: v.string(),
    excerpt: v.optional(v.string()),
    coverImageUrl: v.optional(v.string()),
    author: v.optional(v.string()),
    tags: v.optional(v.array(v.string())),
    status: v.string(),
  },
  handler: async (ctx, args) => {
    const { id, ...fields } = args;
    const existing = await ctx.db.get(id);
    const publishedAt =
      fields.status === "published" && existing?.status !== "published"
        ? Date.now()
        : existing?.publishedAt;
    await ctx.db.patch(id, { ...fields, publishedAt });
  },
});

/** Delete a blog post */
export const deletePost = mutation({
  args: { id: v.id("blogPosts") },
  handler: async (ctx, args) => {
    await ctx.db.delete(args.id);
  },
});
