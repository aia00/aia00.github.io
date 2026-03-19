# Writer + Screenshot Planner + Two Reviewers Loop for This Repo

This repository can run a small local orchestration script that gives you:

- a `writer` agent that edits files
- a `screenshot planner` agent that decides whether screenshots are worth taking before the writer and before the visual reviewer
- a `code/content reviewer` agent that checks implementation quality, content correctness, and scientific reliability
- a `visual reviewer` agent that checks desktop layout, formulas/math rendering, and figure aesthetics
- a bounded loop that repeats until all enabled reviewers approve or the round limit is hit

The entry point is [scripts/agent-pair.mjs](/home/ykwang/personal_stuff/aia00.github.io/scripts/agent-pair.mjs).

## Why this shape

For this repo, the simplest useful architecture is:

1. a local Node script owns the loop
2. the writer, screenshot planner, and two reviewers are just role-specific `codex exec` runs
3. Codex itself handles repository inspection and edits inside its own sandbox
4. the script decides when to stop

That separation matters:

- the loop policy lives in deterministic code
- repository reads and writes stay local
- the reviewers do not get write tools
- you avoid making multiple agents "free-chat" forever with no cost or stop controls

## What the script does

Each round looks like this:

1. before the writer runs, the screenshot planner decides whether current-state screenshots would help diagnose an existing visual problem
2. if the planner says yes and the current repo still builds, the orchestrator serves `dist/` locally and captures pre-change screenshots for the writer
3. the writer receives your task, any reviewer feedback from the previous round, and any pre-change screenshots
4. the writer runs through local `codex exec` and modifies the repo directly
5. the writer must return a structured result describing the changes, validation, and review routes
6. the orchestrator runs the build command
7. if the build passes, the screenshot planner decides whether post-change screenshots should be captured for visual sign-off, and which routes matter most
8. if the planner says yes, the orchestrator serves `dist/` locally and captures screenshots
9. the code/content reviewer and visual reviewer run in parallel
10. the code/content reviewer inspects the repo with read-only tools and returns a correctness-and-reliability verdict, while the visual reviewer inspects screenshots plus repo context and returns a visual verdict
11. if all enabled reviewers return `approved=true`, the loop stops; otherwise the combined reviewer feedback is fed into the next writer round

That screenshot-planner split is meant to avoid wasting screenshot work when it adds no value. The planner is supposed to reason over the real task type, not just whether the word `blog` appears in the prompt. For example:

- if you ask for a brand-new blog post or a fresh content page from source material, the planner will usually skip screenshots before the writer and only capture them before the visual reviewer
- if you ask to fix an existing layout bug, image overflow problem, broken formula rendering, or typography issue, the planner can capture the current broken state before the writer so the writer sees what is wrong before changing code
- if you ask to redesign a shared component, homepage section, navbar, footer, or site-wide styling, the planner can choose representative routes such as `/`, `/about/`, and one content page instead of overfitting to one file path
- if you ask for non-visual work such as analytics wiring, metadata changes, docs edits, or build plumbing, the planner should usually skip screenshots altogether

During `writer` and both reviewers' execution, the script prints concise realtime progress logs from `codex exec`. It preserves command/action logs and also surfaces short plain-language progress updates when the agents emit them. These are execution-stage logs, not a dump of the model's full internal reasoning text.

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

The default round count is now `6`, and the CLI currently clamps `--max-rounds` to the range `1..16`.

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

The current split reviewers can now judge:

- code correctness
- content clarity
- whether blog prose stays in English unless you explicitly ask for another language
- factual and scientific reliability
- consistency with repo style
- whether the build still passes
- whether desktop screenshots suggest good layout, spacing, hierarchy, formula rendering, figure quality, and overall figure composition

The visual reviewer is still not a perfect design oracle. It can catch obviously weak spacing, broken hierarchy, poor balance, malformed formulas or mathematical symbols, and figure problems such as misaligned arrows, text spilling outside boxes, or a composition that feels cramped or visually unbalanced, but its judgment is still bounded by the screenshot evidence you give it.

## Visual review requirements

For screenshot-based review to work well:

- the build must succeed
- a local browser such as `google-chrome-stable` must be available
- the screenshot planner or writer should identify useful `review_routes`
- the environment must allow a local loopback server to bind

If local port binding or browser execution is blocked, the script degrades gracefully and the reviewer will state the visual limitation instead of crashing the whole loop.

The current visual review path is desktop-only. It does not attempt mobile sign-off unless you later add that back explicitly.
