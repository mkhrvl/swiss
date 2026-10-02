---
status: accepted
date: 2026-10-02
---

# Web hosts with a feature-first core

Swiss uses a React and TypeScript PWA built with Vite and `vite-plugin-pwa`, plus a WXT extension. The extension must support Chromium, Firefox, and Zen. Each host owns its UI, temporary workspace state, and platform integration. A private `@swiss/core` package owns processing and business rules. This shares behavior while allowing each host to use a layout suited to its workspace.

Both hosts provide Base64 decoding, English OCR, and Identity password hashing and verification. API key generation, JWT HMAC signing keys, and random passwords are also available through the feature-local TypeScript `secret-generation` module using Web Crypto.

## Structure

```text
apps/
  pwa/
    src/
      app/
      features/
      state/
      platform/
  extension/
    entrypoints/
      background.ts
      sidepanel/
      workspace/
    src/
      features/
      state/
      platform/
packages/
  core/
    package.json
    tsconfig.json
    src/
      result.ts
      base64/
        index.ts
        decode.ts
        decode.test.ts
      ocr/
        index.ts
        engine.ts
        engine.test.ts
        worker.ts
      identity-passwords/
        index.ts
        bridge.ts
        bridge.test.ts
        dotnet/
          Swiss.Identity/
          Swiss.Identity.Browser/
          Swiss.Identity.Tests/
```

This is the target structure. The directories will be created as their features are implemented.

Organize core by tool family. Related operations, formats, error codes, implementation files, and tests stay within that feature. Language-specific subfolders appear where a feature needs another runtime. Keep Identity's C# implementation, browser executable, and .NET test project together within `identity-passwords/dotnet/`.

Use pnpm workspaces. Both hosts compile core's TypeScript directly. Expose feature-specific imports such as `@swiss/core/base64` and `@swiss/core/ocr`. Core stays independent of React, WXT, extension APIs, and host storage. Standard browser capabilities and browser-compatible libraries are allowed in core. Each host owns its visual controls initially.

## Contracts and state

Core uses a small shared discriminated-union result type for expected failures. Each feature owns its result data and stable error codes. Hosts choose the wording and presentation. Password mismatch is a verification outcome. Unexpected failures use exceptions.

Each host maintains feature-organized state at workspace level so navigation preserves inputs, results, and active jobs. Closing a workspace clears its temporary state and stops its jobs. Persist preferences and offline assets only. Passwords, keys, hashes, decoded text, screenshots, and OCR results stay in workspace memory.

The extension uses a side panel with a dedicated-tab workspace. These are independent workspaces using the same extension UI. A deliberate transfer can copy the current input into a new tab; subsequent edits do not synchronize.

## OCR

The first release supports English and returns extracted text. Additional languages, automatic language detection, and word positions are deferred. Tesseract.js is the OCR engine; the first implementation pins version 7.0.0 and the English model with a SHA-256 checksum. See [web conventions](../web.md) for its worker, asset, and dependency-patch details.

Core accepts an image and an optional region in source-image pixels. It owns region validation, cropping, recognition, progress, and cancellation. Hosts own the visual selection interaction and coordinate conversion.

Core declares versioned engine and model asset requirements inside `ocr/`. Hosts resolve asset locations and manage downloads and caching. Asset loading and worker initialization happen lazily inside the first recognition, hash, or verification operation, using its cancellation signal. The PWA caches and verifies required assets automatically for later offline use; the extension bundles both executable assets and the English model so first use also works offline. This replaces explicit preparation controls.

## Identity and verification

Retain the Microsoft Identity implementation in C#. `Swiss.Identity` owns the business logic, `Swiss.Identity.Browser` owns the WebAssembly entrypoint and JavaScript interop, and `Swiss.Identity.Tests` tests the business library. Core's TypeScript bridge hides those runtime details from both hosts.

The [Identity feasibility check](../verification/identity-wasm-feasibility.md) passed web/offline and unpacked-extension checks in Chromium, Firefox, and Zen. A dedicated module worker keeps the synchronous hasher off the UI thread. Explicit cancellation terminates that worker; a later operation creates a fresh runtime.

Colocate ordinary TypeScript tests with their implementations and test feature behavior through public interfaces. C# tests live in their feature's separate test project. Hosts verify state lifetime, input transfer, permissions, asset storage, and presentation. Place focused browser checks under the relevant host or package's `tests/browser/` directory.

## Shared UI primitives

With the adoption of shadcn/ui, `packages/ui` now owns the copied component sources, class utility, and semantic dark theme. Both hosts consume `@swiss/ui/components/*`, but retain their feature screens, layout, workspace state, and platform behavior. UI stays independent of `@swiss/core`. This extends the initial host-local control decision without sharing entire tool screens.
