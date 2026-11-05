import { defineType, defineField } from "sanity";

export const homepageSchema = defineType({
  name: "homepage",
  title: "Homepage",
  type: "document",
  fields: [
    defineField({ name: "title", title: "Title", type: "string" }),
    defineField({ name: "announcement", title: "Announcement strip", type: "text" }),
    defineField({ name: "featured_collection", title: "Featured collection", type: "reference", to: [{ type: "collection" }] }),
    defineField({ name: "hero_content", title: "Hero content", type: "text" }),
  ],
});
