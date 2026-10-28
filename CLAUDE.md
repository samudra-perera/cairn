<!-- cairn:start -->
## Using cairn

cairn is a shared task tracker and memory for this repo. It's used from the
shell with the `cairn` command. Set `CAIRN_AGENT=<your name>` (e.g. `claude`)
so your actions are attributed and you get piggyback notifications.

1. **Before starting:** `cairn search "<topic>"` for related past work, and read the summaries.
2. **Claim:** `cairn claim <id>`.
3. **While working:** `cairn note <id> "<text>"` for decisions, dead ends, or gotchas. Any new notes from the human print automatically before each command's output — read them.
4. **When finished:** `cairn done <id> --summary "<text>"` covering what changed, why, and any gotchas. This moves the task to review, not done — the human reviews and finalizes it.

Other commands: `cairn list` (tasks in the current repo+branch), `cairn show <id>` (full detail + timeline), `cairn add "<title>"` (create a task), `cairn status <id> <status>`. Every command supports `--json`.
<!-- cairn:end -->
