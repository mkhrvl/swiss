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

Swiss (as in Swiss Army knife) is a developer toolbox for decoding Base64, formatting JSON, extracting text from images, hashing passwords, and generating secrets, all without leaving your browser.

> **Everything stays on your device.** Swiss has no backend, analytics, or remote processing. Inputs and results live in memory and are cleared when you close the workspace.

## What you can do

| Tool                   | What it does                                                           |
| ---------------------- | ---------------------------------------------------------------------- |
| **Base64**             | Decode standard or URL-safe Base64 to text, or to hex for binary.      |
| **JSON**               | Validate, format, and minify with syntax highlighting.                 |
| **OCR**                | Extract English text from an image or a selected region.               |
| **Identity passwords** | Generate and verify ASP.NET Identity password hashes.                  |
| **Bcrypt passwords**   | Generate and verify bcrypt hashes with cost guidance.                  |
| **API keys**           | Generate random tokens in Base64url, Base64, or hex.                   |
| **JWT signing keys**   | Generate HMAC keys for HS256, HS384, and HS512.                        |
| **Random passwords**   | Generate 8–128 character passwords from the character sets you choose. |

See [the tool guide](docs/tools.md) for defaults, limits, and usage details.

## Two ways to use Swiss

The **web app** runs in Chromium and Firefox-based browsers and can be installed as a PWA for offline use. It downloads the OCR and Identity assets the first time you use those tools, then works offline.

The **browser extension** works in Chromium and Firefox-based browsers, including Zen. It adds a sidebar, decodes selected text, and captures pages for OCR, so you can use the tools while browsing. It ships with all assets included.

## How the repository is organized

The two hosts, `apps/pwa` and `apps/extension`, share feature logic in `packages/core` and UI components in `packages/ui`, while owning their own layouts and browser integration. See [the architecture overview](ARCHITECTURE.md) for the full repository map.

## Documentation

- [Architecture](ARCHITECTURE.md): system boundaries, processing, state, and offline assets.
- [Development guide](docs/development.md): setup, run commands, verification, distribution, and dependency licenses.
- [Tool guide](docs/tools.md): tool behavior, limits, offline use, and extension actions.
- [Web conventions](docs/web.md): implementation and contribution guidance.
- [Architecture decision](docs/adr/0001-web-hosts-feature-core.md): the two hosts and feature-first core.
- [Code-quality checks](docs/code-quality.md): ESLint and SonarQube editor setup.
- [Verification evidence](docs/verification/web-milestone.md): completed checks and release QA still needed.
