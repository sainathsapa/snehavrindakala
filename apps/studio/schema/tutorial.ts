import { defineType, defineField } from "sanity";

export const tutorialSchema = defineType({
  name: "tutorial",
  title: "Tutorial",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "excerpt", title: "Excerpt", type: "text" }),
    defineField({ name: "body", title: "Body", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "cover_image", title: "Cover image", type: "image" }),
    defineField({ name: "youtube_url", title: "YouTube URL", type: "url" }),
    defineField({ name: "skill_level", title: "Skill level", type: "string", options: { list: ["beginner", "intermediate", "advanced"] } }),
    defineField({ name: "published_at", title: "Published at", type: "datetime" }),
  ],
});
