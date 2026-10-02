# Code-quality checks

Run these commands from the repository root:

```sh
pnpm lint       # Fail on lint errors or warnings
pnpm lint:fix   # Apply available fixes, then review the diff
pnpm verify     # Formatting, lint, types, tests, and production builds
```

`eslint.config.mjs` uses ESLint 9 with recommended JavaScript/TypeScript and JSX accessibility rules, plus React's Rules of Hooks and effect dependency checks. It covers both hosts, shared core/UI, configurations and JavaScript scripts. Browser runners allow both Node globals and browser globals for their evaluated callbacks. Generated assets, builds, .NET outputs and agent tooling are excluded. Intentionally unused callback parameters may start with `_`; other unused bindings are errors. Prettier owns formatting through `eslint-config-prettier`.

The workspace uses Microsoft's [side-by-side TypeScript setup](https://devblogs.microsoft.com/typescript/announcing-typescript-7-0/#running-side-by-side-with-typescript-6.0): `@typescript/native` aliases TypeScript 7.0.2, which supplies `tsc`, while `typescript` aliases `@typescript/typescript6` 6.0.2 for tooling that needs the legacy compiler API. typescript-eslint does not support the TypeScript 7 API yet. `pnpm check` continues to use TypeScript 7; these baseline lint rules do not replace type checking.

## SonarQube in the editor

Install the workspace's recommended **SonarQube for IDE** extension (`SonarSource.sonarlint-vscode`) and **ESLint** (`dbaeumer.vscode-eslint`). SonarQube provides local editor diagnostics without a server, including the `typescript:S…` warnings previously encountered in Swiss. It is separate from `pnpm lint` and does not enforce a CI quality gate.

Swiss currently uses editor-only SonarQube checks. No server connection or CI scan is required. In VS Code, open Extensions, find the workspace recommendations and install both extensions; reload the editor if prompted. Source files will then show lint and SonarQube diagnostics in the Problems panel.

If a SonarQube Server/Cloud project exists, use the extension's **Connected Mode** to bind this workspace to it and synchronize the team's quality profile. Keep authentication tokens in the extension's connection management rather than committed workspace settings. Follow the official [installation](https://docs.sonarsource.com/sonarqube-for-vs-code/getting-started/installation) and [connected-mode setup](https://docs.sonarsource.com/sonarqube-for-vs-code/connect-your-ide/setup) guides.

## Optional Server/Cloud analysis

Use **SonarScanner for .NET** for this mixed TypeScript/C# repository. Its multi-language analysis includes the PWA, extension, shared TypeScript/UI and C# library in one SonarQube project. The plain npm/CLI scanner does not perform the required C# build analysis.

No server, project binding, scanner tool or CI job is configured yet. To enable full analysis:

1. Create a project on SonarQube Server (or Community Build) or SonarQube Cloud, then choose its quality profile and quality gate.
2. Record the scanner in the local .NET tool manifest: `dotnet tool install dotnet-sonarscanner --version 11.2.0`. Commit the manifest after validating compatibility with the chosen server. Other developers/CI use `dotnet tool restore`.
3. Supply `SONAR_HOST_URL`, `SONAR_PROJECT_KEY` and `SONAR_TOKEN` through the environment or CI secrets. Cloud also needs the organization key; use its project onboarding instructions for the host/region settings.
4. Run regular verification, then run a separate analysis build from the repository root. Sonar's begin step changes build analyzer settings and warnings-as-errors behavior, so keep the normal verification gate independent.

The following template is for **SonarQube Server**, once those environment variables are set:

```sh
pnpm install --frozen-lockfile
pnpm verify
dotnet tool restore

dotnet sonarscanner begin \
  /k:"$SONAR_PROJECT_KEY" \
  /d:sonar.host.url="$SONAR_HOST_URL" \
  /d:sonar.token="$SONAR_TOKEN" \
  /d:sonar.projectBaseDir="$PWD" \
  /d:sonar.scanner.scanAll=true \
  /d:sonar.exclusions="**/node_modules/**,**/bin/**,**/obj/**,**/dist/**,**/.output/**,**/.wxt/**,**/public/ocr/**,**/public/identity/**,artifacts/**,TestResults/**,playwright-report/**,.agents/**,.codex/**" \
  /d:sonar.test.inclusions="**/*.test.ts,**/tests/browser/**" \
  /d:sonar.qualitygate.wait=true
dotnet build Swiss.slnx -c Release --no-incremental --disable-build-servers
dotnet sonarscanner end /d:sonar.token="$SONAR_TOKEN"
```

Run this in a separate checkout from active development. Scanner hooks remain active between `begin` and `end`; always finish the end step or discard that isolated checkout after a failure. For CI, use a full Git checkout and make a failed quality gate fail the analysis job. Pull-request analysis and decoration depend on the selected SonarQube edition/plan and repository integration.

The repo currently does not generate coverage reports. Running tests alone does not upload coverage: wire Vitest LCOV via `sonar.javascript.lcov.reportPaths` and a supported C# coverage report before relying on coverage conditions in the quality gate. Browser tests remain separate verification; keep secrets and real workspace data out of uploaded artifacts.

Scanner configuration belongs in its `begin` arguments or an analysis XML file; `sonar-project.properties`, `sonar.sources` and `sonar.tests` are not the configuration mechanism for the .NET scanner. See SonarSource's [scanner usage](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/dotnet/using), [multi-language configuration](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/dotnet/configuring#multi-language-analysis) and [scanner installation](https://docs.sonarsource.com/sonarqube-server/analyzing-source-code/scanners/dotnet/installing) documentation.
