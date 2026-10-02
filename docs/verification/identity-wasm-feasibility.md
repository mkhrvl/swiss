# Identity WebAssembly feasibility

The existing `IdentityPasswordService` and `IdentityVerificationResult` ran unchanged in a .NET browser WebAssembly executable. A module worker exposed hashing and verification to a plain JavaScript page and temporary unpacked extensions. No Blazor UI or server was used.

## Results

| Browser                          | Web and offline reload | Extension page under CSP |
| -------------------------------- | ---------------------- | ------------------------ |
| Chrome for Testing 151.0.7922.34 | Passed                 | Passed                   |
| Firefox 157.0                    | Passed                 | Passed                   |
| Zen 1.22.3b                      | Passed                 | Passed                   |

Each run checked native-generated Identity V2/V3 hashes, upgrade-needed outcomes, wrong passwords, malformed input, the iteration bound, independent salts, exact spaces and Unicode, main-thread responsiveness, active-job cancellation, and fresh-worker recovery. Browser-generated hashes also verified successfully in native .NET. The final runs reported no browser errors.

Chromium's web check disabled networking before a fresh reload. Firefox and Zen reloaded after their local server stopped. The final web checks disabled the browser's HTTP cache and reran hashing and verification from the service-worker cache, including .NET's globalization data files. Extensions loaded their runtime and assemblies from their own packaged origin with `script-src 'self' 'wasm-unsafe-eval'` and `worker-src 'self'`.

## Build and execution

The probe used SDK 10.0.112, the installed WebAssembly workload/runtime pack 10.0.2, and `Microsoft.Extensions.Identity.Core` 10.0.12. It published a trimmed Release build with hot reload and native relinking disabled. The complete raw runtime, assembly, and globalization asset set totals 7,286,968 bytes, about 7.3 MB. Production should pin and validate its chosen SDK, workload, runtime, and dependency versions together.

The existing hasher is synchronous and has no cooperative cancellation interface. The probe cancelled active work by terminating its dedicated worker, then proved that a new worker could verify another hash. This resets the feature's runtime and requires initialization again on the next operation.

Source, local runtime assets, fixtures, run scripts, and six result files are preserved in [the feasibility archive](../../artifacts/identity-wasm-feasibility.zip). The probe is throwaway code, not a production implementation.

## Scope

This proves the C# business implementation, browser-worker execution, offline runtime assets, and extension-page CSP compatibility. The probe used plain JavaScript, a service worker, and direct extension manifests. WXT/Vite integration, side-panel behavior, screenshot capture, OCR, production state management, and store distribution still need their own implementation and validation.

Primary documentation: [Microsoft's JavaScript/.NET browser interop guide](https://learn.microsoft.com/aspnet/core/client-side/dotnet-interop/wasm-browser-app?view=aspnetcore-10.0), [cross-platform cryptography](https://learn.microsoft.com/dotnet/standard/security/cross-platform-cryptography), and [WXT entrypoints](https://wxt.dev/guide/essentials/entrypoints).
