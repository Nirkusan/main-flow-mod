# 07: Bug flow and detours

**What to build:** A third flow, Bug: diagnose, then retro, with an optional improve-architecture row. A diagnosis Claude starts in the middle of a Full or Quick build is a detour that leaves the flow where it is.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] Bug flow: `/diagnosing-bugs` (hint "No theories until one command goes red on this bug."), `/retro` (hint "Ask what would have prevented this bug, in this same session."), optional `/improve-codebase-architecture`
- [ ] No Feature field on the Bug flow
- [ ] A diagnose run with no flow, or a complete one, picks the Bug flow
- [ ] A diagnose run during an unfinished Full or Quick flow adds a dim "Diagnosed a bug" row after the current step and toasts, without moving the flow
