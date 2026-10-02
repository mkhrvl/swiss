# Swiss

Swiss (as in Swiss Army knife) is a local developer toolbox for decoding data, extracting text from images, working with password hashes, and generating secrets. All processing runs on your device. Inputs and results stay in memory for the lifetime of an open workspace.

## What you can do

- Decode Base64.
- Extract English text from images with OCR, including a selected region.
- Generate and verify ASP.NET Identity and bcrypt password hashes.
- Generate random API keys, JWT HMAC signing keys, and passwords.

See [the tool guide](docs/tools.md) for defaults, limits, and usage details.

## Two ways to use Swiss

The **PWA** is a standalone web workspace built with React and Vite. It supports offline use and can be installed in browsers that support PWA installation.

The **browser extension** is built with WXT for Chromium and Firefox-based browsers, including Zen. It adds a sidebar, selection decoding, and page capture for OCR, so you can use the tools while browsing.

Both hosts run tools locally without a backend, analytics, or remote processing. The extension bundles OCR and Identity assets; the PWA caches them on first use for later offline sessions. Closing a workspace clears its inputs and results.

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
