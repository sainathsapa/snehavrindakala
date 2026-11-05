import { defineType, defineField } from "sanity";

export const artistStorySchema = defineType({
  name: "artistStory",
  title: "Artist Story",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "excerpt", title: "Excerpt", type: "text" }),
    defineField({ name: "body", title: "Body", type: "array", of: [{ type: "block" }] }),
    defineField({ name: "cover_image", title: "Cover image", type: "image" }),
    defineField({
      name: "artist_id",
      title: "Artist ID",
      type: "string",
      description: "Medusa artist ID this story refers to.",
    }),
    defineField({ name: "published_at", title: "Published at", type: "datetime" }),
  ],
});
