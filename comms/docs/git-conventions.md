# Git Conventions

**Maintained by:** Kirk
**Status:** Active — all crew must follow

---

## Commit Ownership

Two people commit. Nobody else touches git.

| Domain                                | Committer | Contributors           |
| ------------------------------------- | --------- | ---------------------- |
| Code (`src/`, `tests/`, config files) | Scotty    | Scotty, Spock, Bones   |
| Comms (`comms/`)                      | Kirk      | Everyone (via inboxes) |

### Why

Shared git access across the whole crew leads to cross-contamination — files from one person's work getting swept into another person's commit. We saw this in Phase 1. One commit, one owner, clean history.

### How It Works

**Code commits (Scotty):**

- Spock and Bones write code and tests in their domains (`src/models/`, `src/engine/`, `tests/`, etc.)
- When their work is ready, they notify Scotty via inbox
- Scotty reviews, stages, and commits with proper scoping
- Spock and Bones do NOT run `git add` or `git commit`

**Scotty is the gatekeeper.** He is ultimately responsible for the integrity of the codebase. This means:

- He reviews ALL code before it enters the repo — his own included
- He is ruthless with other people's code. If it's not clean, correct, and simple, it doesn't get committed. Send it back with specific feedback.
- He is his own worst critic. His code gets held to the same standard or higher. No shortcuts because "I wrote it so I know it works."
- If something breaks in the repo, it's Scotty's problem. That's the weight that comes with owning the commit.
- "It works" is not good enough. It has to be right.

**Comms commits (Kirk):**

- All crew write to inboxes, notes, journals as normal
- Kirk commits all `comms/` changes
- Kirk does NOT commit code

### Commit Message Format

```
[domain] short summary
```

Domains: `[backend]`, `[frontend]`, `[data]`, `[test]`, `[docs]`, `[infra]`, `[meta]`, `[build]`

- `[meta]` for comms-only changes (plans, specs, inbox traffic, journals)
- One task per commit. If you can't describe it in one line, the task was too big.

### Reporting Flow

```
Spock/Bones  -->  Scotty's inbox  -->  Scotty commits code
Everyone     -->  Kirk's inbox    -->  Kirk commits comms
```

Spock and Bones report to Scotty on code matters. Everyone reports to Kirk on everything else. The chain is clear.
