import { defineType, defineField } from "sanity";

export const faqSchema = defineType({
  name: "faq",
  title: "FAQ",
  type: "document",
  fields: [
    defineField({ name: "question", title: "Question", type: "string", validation: (Rule) => Rule.required() }),
    defineField({ name: "answer", title: "Answer", type: "text" }),
    defineField({ name: "category", title: "Category", type: "string", options: { list: ["shipping", "returns", "commissions", "orders", "payments"] } }),
  ],
});
