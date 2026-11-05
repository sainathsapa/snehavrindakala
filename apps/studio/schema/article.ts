import { defineType, defineField } from "sanity";

export const articleSchema = defineType({
  name: "article",
  title: "Journal Article",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "excerpt", title: "Excerpt", type: "text" }),
    defineField({ name: "body", title: "Body", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "cover_image", title: "Cover image", type: "image" }),
    defineField({
      name: "related_artist_id",
      title: "Related artist ID",
      type: "string",
      description: "Medusa artist ID this story refers to.",
    }),
    defineField({
      name: "related_product_id",
      title: "Related product ID",
      type: "string",
      description: "Medusa product ID this story refers to.",
    }),
    defineField({ name: "published_at", title: "Published at", type: "datetime" }),
  ],
});
