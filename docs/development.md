# Development guide

Run all commands from the repository root. For an overview of Swiss, see [the README](../README.md); for tool behavior and limits, see [the tool guide](tools.md).

## Setup and local development

Install Node.js 24, pnpm 11.24.0, and .NET SDK 10.0.112. The workspace pins SDK/workload and package versions. Install the WebAssembly workload, then run:

```sh
dotnet workload install wasm-tools --version 10.0.102
pnpm install
pnpm dev                 # PWA at http://127.0.0.1:5173
pnpm dev:extension       # Chromium extension development
pnpm dev:firefox         # Firefox extension development
```

After adding or updating workspace dependencies, stop the development server, run `pnpm install`, then start it again. Restart development after adding shared UI components as well: Vite can retain a failed import resolution from before the new component existed, even when its file and package export are correct.

To launch development in Zen, configure `webExt.binaries.firefox` in `apps/extension/wxt.config.ts` to your Zen executable or load the Firefox production build temporarily as described below.

## Verification

```sh
pnpm lint               # ESLint: TypeScript, React Hooks, accessibility, JS scripts
pnpm lint:fix           # Apply available safe lint fixes; review the diff
pnpm verify             # Formatting, lint, types, TypeScript/C# tests, all builds
```

ESLint runs from the repository root with `eslint.config.mjs`; Prettier owns formatting. VS Code recommends ESLint and SonarQube for IDE. See [code-quality checks](code-quality.md) for editor checks and the optional SonarQube Server/Cloud setup for both TypeScript and C#.

Browser checks use real English OCR in isolated profiles:

```sh
pnpm exec playwright install chromium
pnpm test:browser
# Or use an existing Chrome for Testing/Chromium executable:
SWISS_CHROMIUM=/path/to/chrome pnpm test:browser
# Live development servers (cold dependency cache for the PWA):
SWISS_CHROMIUM=/path/to/chrome pnpm test:dev
SWISS_GECKO=/path/to/firefox pnpm test:dev:firefox
SWISS_GECKO=/path/to/zen pnpm test:dev:firefox zen
# Stock Firefox and Zen (not Playwright's patched Firefox):
SWISS_GECKO=/path/to/firefox node apps/extension/tests/browser/gecko.mjs firefox
SWISS_GECKO=/path/to/firefox node apps/extension/tests/browser/gecko.mjs firefox extension
SWISS_GECKO=/path/to/zen node apps/extension/tests/browser/gecko.mjs zen
SWISS_GECKO=/path/to/zen node apps/extension/tests/browser/gecko.mjs zen extension
```

Build the hosts with `pnpm build` before running production browser checks. `pnpm verify` includes this build. Development browser checks prepare their own assets.

Browser-store submission, native browser permission prompts, toolbar/sidebar gestures, context menus, and shortcut customization still require interactive release QA. See [verification evidence](verification/web-milestone.md) for completed checks.

## Build and distribution

Run `pnpm build` to prepare local assets and build the PWA, Chromium extension, and Firefox extension.

Preview the built PWA locally with `pnpm --filter @swiss/pwa preview`.

The PWA builds to `apps/pwa/dist`. Serve it from the root of an HTTPS origin (localhost also works). Install it through a supporting browser's install control. Firefox and Zen can use the web app and its offline behavior even where PWA installation is unavailable. Updates show a reload button and warn that reloading clears the workspace.

Load `apps/extension/.output/chrome-mv3` with **Load unpacked** on `chrome://extensions`. For Firefox or Zen, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `apps/extension/.output/firefox-mv2/manifest.json`. Temporary add-ons disappear when the browser closes; signed distribution is a later release step. If WXT cannot launch a browser from WSL, keep `pnpm dev:firefox` running and load `apps/extension/.output/firefox-mv2-dev/manifest.json` manually in Firefox or Zen; that development build connects to the running server.

Deploy the Identity `.wasm` files with `application/wasm` and the `.js` files with a JavaScript MIME type.

## Shared C# library

Identity's business library, browser interop executable, and native tests live under `packages/core/src/identity-passwords/dotnet/`. `Swiss.slnx` contains these three projects. NuGet versions remain centrally managed in `Directory.Packages.props`.

For a focused .NET check, run:

```sh
sh scripts/verify.sh
```

This restores the pinned CSharpier formatter, checks formatting, builds the shared solution in Release with warnings treated as errors, and runs the native Identity tests. `pnpm verify` additionally checks TypeScript and builds both web hosts. Native tests use xUnit v3 on Microsoft Testing Platform and AwesomeAssertions; no database or remote service is needed at runtime.

## Add a utility

Keep processing and business rules in a feature-local module under `packages/core/src/`, exposing a feature subpath. Each host owns its feature screens, workspace state, and platform integration. Compose shared shadcn/ui primitives from `packages/ui`. Follow [the web conventions](web.md) for worker lifetimes, offline assets, accessibility, and verification.

See [the architecture overview](../ARCHITECTURE.md) for the current system and [the architecture decision](adr/0001-web-hosts-feature-core.md) for the reasoning behind the two hosts and feature-first core.

## Dependency licenses

bcryptjs is BSD-3-Clause licensed. Microsoft's Identity package and CSharpier are MIT licensed. Lucide icons are ISC licensed. xUnit and AwesomeAssertions are Apache-2.0 licensed. react-resizable-panels is MIT licensed. Copied shadcn/ui primitives retain their MIT notice in `packages/ui/LICENSE.md`. Microsoft’s jsonc-parser 3.3.1 is MIT licensed; asset preparation includes its notice at `licenses/jsonc-parser.txt` in both hosts. Bundled Tesseract.js/core are Apache-2.0 licensed and the English model package is MIT licensed. Retain applicable notices when distributing the web hosts.
