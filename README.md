# cairn

*Leave a trail for whoever comes next.*

A terminal task manager and shared memory for you and your coding agents.

## Requirements

- [Bun](https://bun.sh) >= 1.3

## Install

```bash
bun install
```

## Run

```bash
# TUI (bare command, no args)
bun run dev

# CLI (any subcommand)
bun run dev add "task title"
bun run dev list
bun run dev show 1
```

### Acting as an agent

Set `CAIRN_AGENT=<name>` to act as an agent rather than yourself. This affects
privacy filtering, piggyback notifications, and the `done`/`status` rules
(agents can't set status to `done` directly — their work lands in `review`).

```bash
CAIRN_AGENT=claude bun run dev claim 1
CAIRN_AGENT=claude bun run dev note 1 "using jose, not jsonwebtoken"
CAIRN_AGENT=claude bun run dev done 1 --summary "added jwt middleware"
```

### Database

Defaults to `~/.cairn/cairn.db`. Override with `CAIRN_DB_PATH=/path/to.db` to
sandbox a session without touching your real data:

```bash
CAIRN_DB_PATH=/tmp/cairn-play.db bun run dev list
```

## Test & typecheck

```bash
bun test
bun run typecheck
```
