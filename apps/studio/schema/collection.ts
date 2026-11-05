import { defineType, defineField } from "sanity";

export const collectionSchema = defineType({
  name: "collection",
  title: "Editorial Collection",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "slug", title: "Slug", type: "slug", options: { source: "title" } }),
    defineField({ name: "description", title: "Description", type: "text" }),
  ],
});
