#!/usr/bin/env sh
set -eu
cd "$(dirname "$0")/.."
dotnet tool restore
dotnet csharpier check .
dotnet build Swiss.slnx -c Release -p:TreatWarningsAsErrors=true
dotnet test --project packages/core/src/identity-passwords/dotnet/Swiss.Identity.Tests/Swiss.Identity.Tests.csproj -c Release --no-build
