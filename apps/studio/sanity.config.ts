import { defineConfig } from "sanity";
import { structureTool } from "sanity/structure";
import { schemaTypes } from "./schema";

export default defineConfig({
  name: "snehavrinda-kala",
  title: "SnehaVrinda Kala",
  projectId: process.env.SANITY_PROJECT_ID || "placeholder",
  dataset: process.env.SANITY_DATASET || "production",
  plugins: [structureTool()],
  schema: {
    types: schemaTypes,
  },
});
