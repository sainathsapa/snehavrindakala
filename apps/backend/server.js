// Production entry point for the Medusa v2 backend.
//
// The `medusa start` CLI wrapper in @medusajs/medusa-cli cannot resolve
// deep subpaths of @medusajs/medusa (they are not in its `exports` map),
// which surfaces as `TypeError: cmd is not a function`. We require the
// start command module directly by its resolved absolute path instead.
// `start()` boots the Express server, registers /health, and keeps the
// process alive — suitable for production (no file watching / HMR).
"use strict";

const path = require("path");

const medusaRoot = path.dirname(
  require.resolve("@medusajs/medusa/package.json")
);
const { default: start } = require(
  path.join(medusaRoot, "dist/commands/start.js")
);

start({
  port: parseInt(process.env.PORT || "9000", 10),
  directory: process.cwd(),
}).catch((err) => {
  console.error("Error starting server", err);
  process.exit(1);
});
