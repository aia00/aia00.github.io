# Dual-Agent Loop for This Repo

This repository can run a small local orchestration script that gives you:

- a `writer` agent that edits files
- a `reviewer` agent that inspects the result
- a bounded loop that repeats until the reviewer approves or the round limit is hit

The entry point is [scripts/agent-pair.mjs](/home/ykwang/personal_stuff/aia00.github.io/scripts/agent-pair.mjs).

## Why this shape

For this repo, the simplest useful architecture is:

1. a local Node script owns the loop
2. the writer and reviewer are just two role-specific `codex exec` runs
3. Codex itself handles repository inspection and edits inside its own sandbox
4. the script decides when to stop

That separation matters:

- the loop policy lives in deterministic code
- repository reads and writes stay local
- the reviewer does not get write tools
- you avoid making two agents "free-chat" forever with no cost or stop controls

## What the script does

Each round looks like this:

1. the writer receives your task and any reviewer feedback from the previous round
2. the writer runs through local `codex exec` and modifies the repo directly
3. the writer must return a structured result describing the changes, validation, and review routes
4. the writer also provides `review_routes` for rendered inspection
5. the orchestrator runs the build command
6. if the build passes, the orchestrator serves `dist/` locally and captures screenshots
7. the reviewer inspects the repo with read-only tools plus the screenshot evidence
8. the reviewer returns a structured verdict
9. if `approved=true`, the loop stops; otherwise the reviewer feedback is fed into the next writer round

## Run it

Set the optional environment variables in `.env` or your shell:

```bash
CODEX_WRITER_MODEL="gpt-5.4"
CODEX_REVIEWER_MODEL="gpt-5.4"
CODEX_VISUAL_BROWSER="google-chrome-stable"
```

Then run:

```bash
npm run agent:pair -- --task="Rewrite the MCP blog post intro to be tighter and more concrete."
```

Or:

```bash
npm run agent:pair -- "Update the homepage hero copy and check that the site still builds."
```

Useful flags:

- `--max-rounds=6`
- `--max-review-routes=3`
- `--build-command="npm run build"`
- `--disable-visual-review`
- `--oss`
- `--local-provider=ollama`

Dirty worktrees are allowed by default. Pre-existing modified files are treated as baseline context and are excluded from the "newly changed this round" view used by the loop.

## Prerequisites

This script no longer makes direct model requests itself.

It requires the local `codex` CLI instead.

Typical setup:

1. install or make sure `codex` is already available in your shell
2. if you want the default cloud-backed Codex runtime, run `codex login`
3. if you want a fully local model, use `--oss` and ensure Ollama or LM Studio is already running

So there are two modes:

- local CLI + Codex account session
- local CLI + local OSS model provider

## Does this require MCP?

No, not for the first version.

This script uses the local Codex CLI. That is enough because the only capabilities you need right now are local repository operations and a local validation command.

Use MCP later when one of these becomes true:

- multiple agent runtimes need the same capability
- the capability should be reusable outside this script
- you want to connect to a real external system such as GitHub, Figma, Notion, a docs service, or an internal API
- you want a standardized interface instead of ad hoc local wrappers

In short:

- this loop itself is an orchestration problem
- MCP is an interface problem

So the clean order is:

1. make the dual-agent workflow behave well locally
2. identify which capabilities are stable and worth reusing
3. only then move those capabilities behind MCP servers

## When MCP is actually helpful here

For this repo, MCP becomes attractive if you later want the agents to do things like:

- read and write GitHub issues or pull requests
- fetch design references from Figma
- query analytics or content metadata from a separate service
- use a shared docs server across multiple agents or editors

If you only want one local script to edit this site, MCP is optional.

## Important limitation

The current reviewer can now judge:

- code correctness
- content clarity
- consistency with repo style
- whether the build still passes
- whether screenshots suggest good layout, spacing, hierarchy, and basic responsiveness

The current reviewer is still not a perfect design oracle. It can catch obviously weak spacing, broken hierarchy, poor balance, and some responsive issues, but aesthetic judgment is still bounded by the screenshot evidence you give it.

## Visual review requirements

For screenshot-based review to work well:

- the build must succeed
- a local browser such as `google-chrome-stable` must be available
- the writer should provide useful `review_routes`
- the environment must allow a local loopback server to bind

If local port binding or browser execution is blocked, the script degrades gracefully and the reviewer will state the visual limitation instead of crashing the whole loop.
