# Tool guide

Swiss runs each tool on your device. The PWA and browser extension provide the same tools; see [the development guide](development.md) to run or load them.

## Workspace and navigation

Each open workspace keeps its inputs, images, results, and jobs in memory across tool navigation. Closing it clears that state. Offline assets are the only persistent data in this milestone. There is no backend, analytics, or remote recognition service.

Choose tools in the sidebar, with separate **Identity**, **Bcrypt**, and **Generators** groups. **Toggle Sidebar** collapses it to icons on desktop and opens a tool drawer on narrow screens. Both hosts respect the system’s reduced-motion preference.

## Browser extension actions

Click the Swiss toolbar button to open the side panel/sidebar. Use the selection context menu to decode Base64, the page context menu or **Alt+Shift+O** to capture the visible page for OCR, or **Capture page** in the sidebar after granting access by clicking the toolbar button on that page. Restricted browser pages cannot be captured. **Open in tab** transfers the current tool's inputs once into an independent workspace, including Identity password/hash inputs. It does not synchronize later edits or transfer results or crop selection. Transfer data stays in background memory for at most 60 seconds; URLs contain only a one-time token.

## OCR

OCR loads automatically when you choose **Extract text**. The PWA caches about 15 MB of local assets on first use; the extension bundles the engine and pinned English model, including about 3 MB of model data, so its first operation works offline. The model's SHA-256 is checked before use. Recognition runs locally, accepts PNG/JPEG/WebP up to 20 MB and 20 million pixels, and supports a region in source-image pixels. Cancel stops loading or terminates the OCR worker; a later job retries automatically. The PWA reloads missing or damaged model data when online.

## Identity passwords

Choose **Hash password** to generate a salted Identity V3 hash, or **Verify password** to check an existing V2/V3 hash after a 250 ms typing pause. Passwords are visible, and **Clear** erases the fields. Password spaces and Unicode are preserved exactly. Legacy matches show upgrade advice. Hashes over 4,096 encoded characters, over 1,000,000 PBKDF2 iterations, or over 64 subkey bytes are rejected before expensive work. **Cancel** stops the dedicated worker; the next operation initializes a fresh runtime. Hashing and verification run locally through Microsoft's `PasswordHasher<TUser>`.

Identity loads automatically on the first hash or verification. The extension bundles its runtime; the PWA caches about 7.3 MB on first use and verifies cached files before using them in a new workspace. Missing or damaged files are replaced automatically when online. After a tool's first successful use, its cached assets support offline reloads; browser storage eviction requires going online for that tool again.

## Secret generators

The **Generators** group provides API keys, JWT signing keys, and random passwords. API keys default to 32 cryptographically random bytes encoded as unpadded Base64url; choose a multiple-of-16 preset from 16–128 bytes or enter a custom whole-number count, and select Base64url, Base64, or Hex. They are random tokens for your own API, not credentials registered with an external service. JWT signing keys support HS256/HS384/HS512 with 32/48/64 random bytes respectively, defaulting to Base64. Decode the chosen encoding to raw bytes before supplying a JWT signing key to your library.

Random passwords default to 20 characters with lowercase letters, uppercase letters, digits, and symbols. Adjust length with the slider or numeric input; both stay synchronized from 8–128 characters. Select at least one character type; every selected type appears in the result. All three tools work immediately offline without downloads, keep independent settings/results across navigation, and display generated values directly. Opening a generator for the first time produces five choices automatically. Returning to it preserves the current results; Generate refreshes all five. Each row has an inline regenerate icon and a COPY button that shows COPIED for two seconds after a successful copy. Every option change regenerates all five results immediately. Invalid options clear the results and show a validation message. The extension’s **Open in tab** transfers only generator options, never generated secrets; the new workspace generates its own fresh choices.

## Bcrypt passwords

The **Bcrypt** group contains **Generate bcrypt hash** and **Verify bcrypt hash**. Cost uses a synchronized slider/numeric input from 4–20, default 12; bcrypt's standard minimum is 4. Costs 4–9 show **Low**, 10–11 **Acceptable**, 12–14 **Recommended starting range**, and 15–20 **Very expensive**. These are starting points based on [OWASP's minimum of 10](https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html#bcrypt); benchmark on your deployment hardware. Each increment doubles the work.

Generation produces one salted `$2b$` hash. Verification accepts `$2a$`, `$2b$` and `$2y$` and uses the cost embedded in the hash; costs above 20 are rejected before processing. Both operations run only when their button is pressed and can be cancelled, including at cost 20. Changing an input aborts its active job and clears stale results. Passwords preserve spaces and Unicode, are visible, and are limited to 72 UTF-8 bytes for both operations; longer input is rejected without truncation. Clear erases that tool's fields; the chosen cost is retained. The output has inline COPY/COPIED feedback.

The bundled bcryptjs worker starts lazily, uses Web Crypto for salts and works offline without asset downloads. Tool navigation preserves independent inputs/results in memory. Extension **Open in tab** transfers only password/hash inputs and cost, with passwords visible; generated hashes and verification results are excluded.
