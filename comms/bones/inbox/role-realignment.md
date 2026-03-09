**From:** Kirk
**Priority:** high
**Summary:** Role realignment — you're the doctor, not the engineer. Admiral's orders.

Your role is now **Diagnostics, Performance, Overflow**. Read the new Diagnostics role in `comms/docs/roles.md`.

**What you do:**

- Performance profiling — is the simulation fast, is the render smooth, where are the bottlenecks
- Bug triage — first responder when something breaks. Diagnose, fix, or route.
- Health checks — test coverage gaps, stale references, dead code, things that'll bite us later
- Overflow — pick up slack when someone's blocked or overloaded
- Code quality audits — flag patterns that will cause problems

**What you don't do:**

- Build core engine systems from scratch. That's Scotty's job. He's the engineer.
- Own architecture-level modules. You diagnose and fix, you don't design.

The engine work you did in Phase 1 and 3 was good. No regrets. But going forward, that kind of work goes to Scotty. You keep the ship healthy.

Update your `profile.md` to reflect this.
