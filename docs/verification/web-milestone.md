# First web milestone verification

The first implementation delivered Base64 decoding and English OCR in a Vite PWA and WXT extension, using `@swiss/core`. Identity password hashing and verification now use the shared C# library in both hosts. Secret generators now provide API tokens, JWT HMAC signing keys, and random passwords. Nothing has been published or submitted to browser stores.

## Automated checks

`pnpm verify` checks Prettier/CSharpier, strict TypeScript, 86 TypeScript core/host cases, 22 native Identity cases, and production PWA/Chromium Manifest V3/Firefox Manifest V2 builds. Core cases cover exact UTF-8, BOM/Unicode/whitespace preservation, Base64url and padding, binary/control bytes, invalid inputs, input bounds, OCR image/crop/model bounds, and Identity worker readiness, concurrency, reuse, cancellation and startup recovery. Host cases cover first-use loading, offline cache reuse, missing/corrupted file repair, integrity rejection/retry, cancellation recovery, and invalid cached manifests. Native Identity cases verify compatibility against Microsoft's hasher and reject malformed headers, oversized hashes and excessive PBKDF2 cost.

Real browser checks run with:

| Browser            | Version       | PWA                                                                             | Extension                                                               |
| ------------------ | ------------- | ------------------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| Chrome for Testing | 155.0.8059.12 | Base64, English OCR, crop, cancel/restart, offline reload, 360px/desktop layout | Native extension CSP, OCR, transfer, 320px layout, bundled-model reload |
| Firefox            | 157.0         | Base64, OCR, crop, cancel/restart, offline reload                               | Native extension CSP, OCR, crop, cancel/restart, bundled-model reload   |
| Zen                | 1.22.3b       | Base64, OCR, crop, cancel/restart, offline reload                               | Native extension CSP, OCR, crop, cancel/restart, bundled-model reload   |

PWA offline checks stop the local server and disable HTTP caches before a fresh reload and recognition. Chromium additionally uses browser offline mode. Workspace inputs/results do not survive reload. The Chromium PWA check confirms empty local/session storage and no Tesseract IndexedDB cache. Saved app/model assets are retained.

Extension checks use the bundled pinned English model directly, without cache seeding or download permissions. Chromium starts its first recognition offline. Firefox/Zen install a temporary copy of the built extension with a test-only bootstrap that opens the production workspace tab; the production feature code and CSP are unchanged. Chromium verifies a deliberate one-time Base64 input transfer followed by independent edits. Screenshots and JSON results are generated under ignored `artifacts/web-browser/`.

## Interactive release checks

Before signed/store distribution, check the actual toolbar opening the sidebar, Base64 selection menu, page capture through menu/shortcut/sidebar button, capture permission approval/decline, clipboard on each OS, sidebar close/reopen clearing inputs, zoom and screen-reader navigation, PWA install/update prompts, and browser shortcut conflicts. These native browser interactions are not claimed as covered by the headless suite.

The supplied-model Tesseract initialization bug is fixed by a tracked pnpm patch. Re-run all browser checks before removing the patch or changing OCR versions. Firefox native API differences are handled by its host platform layer.

## Development regressions

Live development checks reproduce and cover failures that production-only checks missed: Firefox CSP conversion during WXT dev startup, Vite's transparent gzip decoding of the English model, first-use dependency optimization reloading the PWA, and cross-origin worker startup in the WXT development extension. The PWA check forces a cold optimizer cache, loads real model assets on the first recognition, and checks crop/cancel/restart. The Firefox/Zen check starts WXT, installs its development output into an isolated profile, and checks real recognition with the pinned model. Both compressed and HTTP-decoded data must pass SHA-256 validation; tampered bytes in either representation are rejected.

## Identity migration

Browser checks include the real C#/WASM runtime and native-generated V2/V3 fixtures. They check salted V3 generation, automatic verification, exact spaces/Unicode, upgrade advice, mismatch and malformed/unsupported hashes, active-worker cancellation, fresh-runtime recovery, latest-input results, navigation state, clearing and password masking. They assert no local/session storage for workspace data. Browser-generated synthetic hashes are saved as ignored test artifacts for verification in native .NET.

The PWA automatically loads and verifies the full raw runtime, assemblies and globalization data on the first operation. Fresh offline reloads disable HTTP caches and rerun hashing/verification after the local server stops. Chromium additionally verifies that first use after reload repairs damaged worker and English model cache entries and that Identity inputs transfer once into an independent extension tab with passwords masked. These checks run in isolated browser profiles; native clipboard, install/update prompts and browser-store distribution remain interactive release checks.

## Shared shadcn/ui

Both hosts compose SidebarProvider, Sidebar, SidebarMenu, and SidebarInset. Desktop navigation collapses to icons; narrow screens use the Sidebar's Sheet drawer. Forms use FieldGroup and Field, panels use Card slots, notices use Alert, and OCR uses Empty and Progress. Input Group retains the Lucide password reveal controls. Appearance comes from the shared theme; host CSS handles page layout and crop geometry.

Formatting, strict types, all 86 TypeScript and 22 native Identity cases, and PWA/Chromium/Firefox production builds pass. The Chromium PWA and extension suites pass real OCR, Identity, cancellation/restart, state lifetime, and fresh offline reloads. The PWA also passes cache repair; the extension passes one-time input transfer into independent workspaces. Focused final UI checks pass at 1100px/360px PWA and 800px/320px extension widths: collapse/expand, active tool names, drawer opening/selection, Escape and Close tools, keyboard focus restoration, long inputs without overflow, password reveal, Clear remasking, and offline Identity tab transfer. Screenshots were inspected, including the extension toolbar wrapping above its content at 320px.

Sidebar state remains in memory without upstream cookie persistence. The copied Sidebar restores focus to its external trigger after mobile dismissal and exposes its expanded state. Progress forwards its value to Radix for accessible progress updates. Shared animation styles are bundled locally.

Stock Firefox 157.0 passes Base64, drawer navigation, real OCR/cropping, cancellation/restart, and fresh offline PWA reloads at 360px. Stock Zen 1.22.3b passes extension OCR and Identity, including fresh reloads under its native CSP. Gecko BiDi cannot resize privileged extension pages; Chromium covers the 320px extension layout.

Current focused evidence is saved under ignored `artifacts/web-browser/standard-ui-checks.json`, `final-*.png`, and the sidebar `*-expanded.png`, `*-collapsed.png`, and `*-drawer.png` files. Native permission prompts, screen readers, browser chrome, and other OS clipboards retain the interactive release checks above.

Sidebar headers show the original mint-green swiss wordmark aligned left, without a divider underneath. Password tools have a separate Identity group. Hidden group labels do not intercept icon clicks when collapsed. `pnpm verify` and focused Chromium checks pass for both hosts. Browser-emulated reduced motion disables drawer/tooltip animations and sidebar transitions, with no active document animations; switching back to no preference restores normal transitions. Drawer Escape dismissal and focus restoration pass under both preferences. The running PWA also picks up the grouping and preference styles. Screenshots were inspected; reduced-motion evidence includes `*-reduced-motion-drawer.png` under the same ignored artifact directory.

## Secret generators

API tokens, JWT HMAC signing keys and random passwords use Web Crypto directly and require no asset loading. Core cases cover byte/encoding preservation, RFC-sized HS256/HS384/HS512 keys usable for real HMAC signing/verification, input bounds, selected password character types, duplicate groups, rejection sampling and failures without insecure fallback. Deterministic samples confirm that minimum-length passwords reject candidates missing a selected type.

Shared browser checks exercise default generation, options, validation, regeneration, visible results/copy feedback, clearing, independent tool state and navigation. Firefox PWA and Zen extension checks pass fresh offline reloads with all three generators. Focused Chromium PWA/extension checks pass at 360px/320px; the JWT screens were visually inspected. Single-choice Radix Toggle Group items use radio selection semantics (`data-state="on"`), rather than `aria-pressed`. The full Chromium PWA/extension suites also pass generator checks after fresh offline reloads. The extension's tab-transfer check confirms options are copied while generated secrets remain in the originating workspace.

After removing generator masking and repeated local-generation messages, `pnpm verify` and focused Chromium generator checks pass in both hosts at 360px/320px. These checks confirm visible results, empty success feedback, the consolidated sidebar footer note, copy feedback, clearing and independent navigation state. Updated JWT screenshots were inspected.

The five-result update passes `pnpm verify` and focused generator checks in Chromium PWA/extension, Firefox PWA and Zen extension. Checks cover five choices, isolated row regeneration, COPY/COPIED feedback returning after two seconds, the correct copied row, clipboard failure, stale copy suppression after regeneration, and clearing copied feedback. Chromium layouts pass at 360px/320px and updated JWT screenshots were inspected. The full OCR/Identity/offline suites were not rerun for this update.

Automatic first-open generation passes `pnpm verify` and the same focused browser checks in all four host/browser combinations. They confirm default five-result batches without clicking Generate, preservation across navigation and rerenders, and cleared results staying empty when revisited. A focused Chromium extension transfer check confirms the receiving tab generates five fresh results from the transferred options and keeps independent state. Full OCR/Identity/offline suites were not rerun for this change.
