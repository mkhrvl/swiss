# Repository guidance

Before changing app code, shared libraries, tests, or build configuration, read [the web conventions](docs/web.md). Use [the development guide](docs/development.md) for run, verification, and distribution commands.

## Subagents

- Keep requirements, decisions, routine exploration, behavior-changing work, failure diagnosis, and final approval in the main session. Gather the needed context there.
- Delegate only bounded, independent work whose result can be used without repeating the investigation.
- Use the smallest workflow that fits the change. Keep file ownership non-overlapping and research, review, and validation proportional to risk.
