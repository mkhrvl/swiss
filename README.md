# Swiss

A local developer toolbox with a React PWA, a WXT browser extension, and a feature-first core. Both web hosts support Base64 decoding, English OCR, ASP.NET Identity password hashing and verification, API key generation, JWT HMAC signing keys, and random passwords. Identity uses the shared C# library through a local WebAssembly worker.

## Web hosts

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

```sh
pnpm verify             # Formatting, TypeScript/C# tests, all production builds
pnpm --filter @swiss/pwa preview
```

The PWA builds to `apps/pwa/dist`. Serve it from the root of an HTTPS origin (localhost also works). Install it through a supporting browser's install control. Firefox and Zen can use the web app and its offline behavior even where PWA installation is unavailable. Updates show a reload button and warn that reloading clears the workspace.

Load `apps/extension/.output/chrome-mv3` with **Load unpacked** on `chrome://extensions`. For Firefox or Zen, open `about:debugging#/runtime/this-firefox`, select **Load Temporary Add-on**, and choose `apps/extension/.output/firefox-mv2/manifest.json`. Temporary add-ons disappear when the browser closes; signed distribution is a later release step. If WXT cannot launch a browser from WSL, keep `pnpm dev:firefox` running and load `apps/extension/.output/firefox-mv2-dev/manifest.json` manually in Firefox or Zen; that development build connects to the running server.

Click the Swiss toolbar button to open the side panel/sidebar. Use the selection context menu to decode Base64, the page context menu or **Alt+Shift+O** to capture the visible page for OCR, or **Capture page** in the sidebar after granting access by clicking the toolbar button on that page. Restricted browser pages cannot be captured. **Open in tab** transfers the current tool's inputs once into an independent workspace, including Identity password/hash inputs. It does not synchronize later edits or transfer results, crop selection, or password visibility. Transfer data stays in background memory for at most 60 seconds; URLs contain only a one-time token.

OCR loads automatically when you choose **Extract text**. The PWA caches about 15 MB of local assets on first use; the extension bundles the engine and pinned English model, including about 3 MB of model data, so its first operation works offline. The model's SHA-256 is checked before use. Recognition runs locally, accepts PNG/JPEG/WebP up to 20 MB and 20 million pixels, and supports a region in source-image pixels. Cancel stops loading or terminates the OCR worker; a later job retries automatically. The PWA reloads missing or damaged model data when online.

Each open workspace keeps its inputs, images, results, and jobs in memory across tool navigation. Closing it clears that state. Offline assets are the only persistent data in this milestone. There is no backend, analytics, or remote recognition service.

Choose **Hash password** to generate a salted Identity V3 hash, or **Verify password** to check an existing V2/V3 hash after a 250 ms typing pause. Passwords start masked; the eye button toggles visibility and **Clear** masks and erases the fields. Password spaces and Unicode are preserved exactly. Legacy matches show upgrade advice. Hashes over 4,096 encoded characters, over 1,000,000 PBKDF2 iterations, or over 64 subkey bytes are rejected before expensive work. **Cancel** stops the dedicated worker; the next operation initializes a fresh runtime. Hashing and verification run locally through Microsoft's `PasswordHasher<TUser>`.

Identity loads automatically on the first hash or verification. The extension bundles its runtime; the PWA caches about 7.3 MB on first use and verifies cached files before using them in a new workspace. Missing or damaged files are replaced automatically when online. After a tool's first successful use, its cached assets support offline reloads; browser storage eviction requires going online for that tool again. Deploy the `.wasm` files with `application/wasm` and the `.js` files with a JavaScript MIME type.

The **Generators** group provides API keys, JWT signing keys, and random passwords. API keys default to 32 cryptographically random bytes encoded as unpadded Base64url; choose a multiple-of-16 preset from 16–128 bytes or enter a custom whole-number count, and select Base64url, Base64, or Hex. They are random tokens for your own API, not credentials registered with an external service. JWT signing keys support HS256/HS384/HS512 with 32/48/64 random bytes respectively, defaulting to Base64. Decode the chosen encoding to raw bytes before supplying a JWT signing key to your library.

Random passwords default to 20 characters with lowercase letters, uppercase letters, digits, and symbols. Adjust length with the slider or numeric input; both stay synchronized from 8–128 characters. Select at least one character type; every selected type appears in the result. All three tools work immediately offline without downloads, keep independent settings/results across navigation, and display generated values directly. Opening a generator for the first time produces five choices automatically. Returning to it preserves the current results; Generate refreshes all five. Each row has an inline regenerate icon and a COPY button that shows COPIED for two seconds after a successful copy. Every option change regenerates all five results immediately. Invalid options clear the results and show a validation message. The extension’s **Open in tab** transfers only generator options, never generated secrets; the new workspace generates its own fresh choices.

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

Both web hosts use shadcn/ui primitives from `packages/ui`, with Tailwind CSS v4, a shared theme, and independently composed layouts. Choose tools in the sidebar, with password hashing and verification in the **Identity** group and secret generation in **Generators**. **Toggle Sidebar** collapses it to icons on desktop and opens a tool drawer on narrow screens. Both hosts respect the system’s reduced-motion preference. Business logic stays in `packages/core`.

See [web conventions](docs/web.md), [the architecture decision](docs/adr/0001-web-hosts-feature-core.md), and [verification evidence](docs/verification/web-milestone.md). Browser-store submission, native browser permission prompts, toolbar/sidebar gestures, context menus, and shortcut customization still require interactive release QA.

## Shared C# library

Identity's business library, browser interop executable, and native tests live under `packages/core/src/identity-passwords/dotnet/`. `Swiss.slnx` contains these three projects. NuGet versions remain centrally managed in `Directory.Packages.props`.

For a focused .NET check, run:

```sh
sh scripts/verify.sh
```

This restores the pinned CSharpier formatter, checks formatting, builds the shared solution in Release with warnings treated as errors, and runs the native Identity tests. `pnpm verify` additionally checks TypeScript and builds both web hosts. Native tests use xUnit v3 on Microsoft Testing Platform and AwesomeAssertions; no database or remote service is needed at runtime.

## Add a utility

Keep processing and business rules in a feature-local module under `packages/core/src/`, exposing a feature subpath. Each host owns its feature screens, workspace state, and platform integration. Compose shared shadcn/ui primitives from `packages/ui`. Follow [the web conventions](docs/web.md) for worker lifetimes, offline assets, accessibility, and verification.

## Dependency licenses

Microsoft's Identity package and CSharpier are MIT licensed. Lucide icons are ISC licensed. xUnit and AwesomeAssertions are Apache-2.0 licensed. Copied shadcn/ui primitives retain their MIT notice in `packages/ui/LICENSE.md`. Bundled Tesseract.js/core are Apache-2.0 licensed and the English model package is MIT licensed. Retain applicable notices when distributing the web hosts.
