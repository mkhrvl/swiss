<p align="center">
  <img src="apps/pwa/public/icon-192.png" alt="Swiss logo" width="80" height="80" />
</p>

<h1 align="center">Swiss</h1>

<p align="center">
  <strong>Local Dev Tools</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/processing-local-90d9ba?style=flat-square&amp;labelColor=15181d" alt="Processing: local" />
  <img src="https://img.shields.io/badge/hosts-PWA%20%2B%20extension-90d9ba?style=flat-square&amp;labelColor=15181d" alt="Hosts: PWA and extension" />
  <img src="https://img.shields.io/badge/browsers-Chromium%20%2B%20Firefox-90d9ba?style=flat-square&amp;labelColor=15181d" alt="Browsers: Chromium and Firefox" />
</p>

<p align="center">
  <a href="docs/development.md">Get started</a> &middot;
  <a href="docs/tools.md">Tool guide</a> &middot;
  <a href="ARCHITECTURE.md">Architecture</a>
</p>

Swiss (as in Swiss Army knife) is a local developer toolbox for decoding data, working with JSON, extracting text from images, working with password hashes, and generating secrets. All processing runs on your device. Inputs and results stay in memory for the lifetime of an open workspace.

## What you can do

| Tool                   | What it does                                           |
| ---------------------- | ------------------------------------------------------ |
| **Base64**             | Decode Base64 data.                                    |
| **JSON**               | Validate, format, and minify with syntax highlighting. |
| **OCR**                | Extract English text from images or a selected region. |
| **Identity passwords** | Generate and verify ASP.NET Identity password hashes.  |
| **Bcrypt passwords**   | Generate and verify bcrypt hashes with cost guidance.  |
| **API keys**           | Generate random tokens in Base64url, Base64, or Hex.   |
| **JWT signing keys**   | Generate HMAC keys for HS256, HS384, and HS512.        |
| **Random passwords**   | Choose the length and character groups.                |

See [the tool guide](docs/tools.md) for defaults, limits, and usage details.

## Two ways to use Swiss

The **PWA** is a standalone web workspace built with React and Vite. It supports offline use and can be installed in browsers that support PWA installation.

The **browser extension** is built with WXT for Chromium and Firefox-based browsers, including Zen. It adds a sidebar, selection decoding, and page capture for OCR, so you can use the tools while browsing.

> **Your workspace stays local.** Both hosts process inputs on your device, without a backend, analytics, or remote processing. Closing a workspace clears its inputs and results.

The extension bundles OCR and Identity assets; the PWA caches them on first use for later offline sessions.

## How the repository is organized

The hosts share business logic and UI components while owning their own layouts and browser integration.

| Path             | Purpose                                                  |
| ---------------- | -------------------------------------------------------- |
| `apps/pwa`       | React/Vite progressive web app                           |
| `apps/extension` | WXT browser extension                                    |
| `packages/core`  | Feature modules containing processing and business rules |
| `packages/ui`    | Shared shadcn/ui components and theme                    |

Core modules are grouped by feature. The Identity feature includes a C# library that runs in the browser through a local WebAssembly worker; the other tools use TypeScript and browser APIs.

## Documentation

- [Architecture](ARCHITECTURE.md): system boundaries, processing, state, and offline assets.
- [Development guide](docs/development.md): setup, run commands, verification, distribution, and dependency licenses.
- [Tool guide](docs/tools.md): tool behavior, limits, offline use, and extension actions.
- [Web conventions](docs/web.md): implementation and contribution guidance.
- [Architecture decision](docs/adr/0001-web-hosts-feature-core.md): the two hosts and feature-first core.
- [Code-quality checks](docs/code-quality.md): ESLint and SonarQube editor setup.
- [Verification evidence](docs/verification/web-milestone.md): completed checks and release QA still needed.
