// pnpmfile.js — allows native-module build scripts despite pnpm 12's
// supply-chain policy blocking them by default (ERR_PNPM_IGNORED_BUILDS).
// Packages that need compilation: sharp, esbuild, msgpackr-extract,
// protobufjs, @medusajs/telemetry, medusa-telemetry, core-js,
// and @img/sharp-* platform binaries.
module.exports = {
  hooks: {
    readPackage: (pkg) => {
      if (
        pkg.name === 'esbuild' ||
        pkg.name === 'sharp' ||
        pkg.name === 'msgpackr-extract' ||
        pkg.name === 'protobufjs' ||
        pkg.name === 'core-js' ||
        pkg.name === 'medusa-telemetry' ||
        pkg.name === '@medusajs/telemetry' ||
        pkg.name?.startsWith('@img/sharp-') ||
        pkg.name?.startsWith('@msgpackr-extract-')
      ) {
        pkg.allowBuildScripts = true
      }
      return pkg
    },
  },
}
