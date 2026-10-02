# NuGet MCP Server: bounded research

Research date: 2026-10-02. This note records documented facts and the evidence gap around package ownership. The repository now configures the server in `.codex/config.toml`.

## Direct conclusion

The official NuGet MCP server is the .NET tool package `NuGet.Mcp.Server`, maintained in the first-party [NuGet/Home repository](https://github.com/NuGet/Home/tree/dev/mcp) and documented by Microsoft Learn. It is a local MCP server using stdio. The official configuration launches it with `dnx`:

```json
{
  "servers": {
    "nuget": {
      "type": "stdio",
      "command": "dnx",
      "args": [
        "NuGet.Mcp.Server",
        "--source",
        "https://api.nuget.org/v3/index.json",
        "--yes"
      ]
    }
  }
}
```

The current NuGet.org search from this workspace returned stable `1.4.16` as the highest listed stable version and `0.1.4-preview` as the only listed preview. An exact-version launch would therefore be `dnx NuGet.Mcp.Server@1.4.16 --source https://api.nuget.org/v3/index.json --yes`, subject to the feed changing after this research date. The package is not a Swiss project dependency.

## Technology and documented behavior

- **Package/API:** `NuGet.Mcp.Server`; MCP stdio server, started as a .NET tool through `dnx` (the .NET `dotnet tool exec` alias). Microsoft documents `dnx` package execution and the `PACKAGE@VERSION` syntax in [dotnet tool exec](https://learn.microsoft.com/dotnet/core/tools/dotnet-tool-exec).
- **Requirements:** Microsoft Learn currently says **.NET 10 SDK or later**. The NuGet repository README says **.NET 10 Preview 6 or later**, the first SDK line that supplied `dnx`. Swiss has SDK **10.0.112**, `global.json` pins that SDK, and `/usr/bin/dnx` is available, so the documented runtime prerequisite is met.
- **Platforms:** The official launch mechanism is the .NET SDK CLI, and Microsoft’s Copilot setup example runs on `ubuntu-latest`; the docs also show Visual Studio configuration on Windows. This supports Linux and Windows hosts through the SDK. No Windows-only server requirement is documented.
- **Tools listed by the NuGet repository README:** `get-nuget-solver` (fix vulnerable package versions), `get-nuget-solver-latest-versions` (latest non-vulnerable versions), `get-latest-package-version`, `get-package-readme`, and `update-package` (update a package to a specified compatible version). The Microsoft Learn guide additionally documents workflows for fixing vulnerabilities, updating all packages to latest compatible versions based on target frameworks, and updating one package to a specified version.
- **Feed/version controls:** the official config passes the NuGet v3 feed URL with `--source`; the repository README also documents pinning a package version with `NuGet.Mcp.Server@<version>`. `--yes` accepts the one-shot tool-download confirmation.
- **Swiss context:** Swiss targets `net10.0` and uses NuGet central package management in `Directory.Packages.props`; the browser interop executable uses the `wasm-tools` workload. The official docs describe NuGet package dependency analysis/updates only. They do not document management of pnpm/npm dependencies, WASM workloads, or other non-NuGet assets.

## Caveats and evidence limits

1. The version result is a point-in-time NuGet.org query (`dotnet package search NuGet.Mcp.Server --exact-match --prerelease --format json --source https://api.nuget.org/v3/index.json`) run on 2026-10-02. It is evidence for `1.4.16` at that time, not a future pin recommendation.
2. Microsoft Learn’s current requirement (“.NET 10 SDK or later”) and the repository README’s older wording (“.NET 10 Preview 6 or later”) differ in phrasing. Both are satisfied by Swiss’s 10.0.112 SDK; the Learn page is the newer requirement statement.
3. First-party sources identify the project as NuGet’s server and link to `NuGet/Home`; they do not expose the NuGet.org account/owner field in the cited text or the CLI search output. “Official Microsoft/NuGet” is supported attribution; an exact nuget.org publisher account remains unverified here.
4. The docs do not state whether the MCP server fully understands Swiss’s central package management file, solution layout, or multi-target/package graph conventions. Compatibility with those details remains an evidence gap. Updating files is an MCP operation whose exact confirmation/approval behavior depends on the MCP client.
5. The server normally waits for MCP protocol messages on stdin when launched, so a direct terminal launch appearing to remain running is expected; a client should own the stdio process.

## Repository setup

`.codex/config.toml` pins `NuGet.Mcp.Server@1.4.16`, launches it through `dnx` from the repository root, and uses the official NuGet.org feed. Initialization and discovery passed with six tools: `review_supply_chain_security`, `get_latest_package_version`, `get_package_context`, `fix_vulnerable_packages`, `update_package_version`, and `upgrade_packages_to_latest`. This runtime discovery supersedes the older tool names in the repository README cited above. Start a fresh Codex session in this trusted repository to load the tools.

## Primary sources

- [Microsoft Learn: Using the NuGet Model Context Protocol (MCP) Server](https://learn.microsoft.com/nuget/concepts/nuget-mcp-server) — requirements, Visual Studio/VS Code/Copilot configuration, and package-update workflows.
- [Microsoft Learn: `dotnet tool exec`](https://learn.microsoft.com/dotnet/core/tools/dotnet-tool-exec) — `dnx` behavior, package/version syntax, feed options, and one-shot execution.
- [NuGet/Home: MCP README](https://github.com/NuGet/Home/blob/dev/mcp/README.md) — official server launch examples and named MCP tools.
- [NuGet/Home: Using NuGet for MCP servers](https://github.com/NuGet/Home/blob/dev/accepted/2025/nuget-mcp.md) — NuGet MCP package conventions and package-type design.
- [NuGet.org package page: `NuGet.Mcp.Server`](https://www.nuget.org/packages/NuGet.Mcp.Server/1.4.16) — package identity/version page; version availability was independently queried with the .NET CLI on the research date.
- Local evidence: `global.json` (`10.0.112`), `Directory.Build.props` (`net10.0`), `Directory.Packages.props`, and `dotnet --info` (SDK `10.0.112`, workload `10.0.102`, Linux x64).
