# 08: Catch-up

**What to build:** Installing the mod mid-build, or resuming a session, the pane picks up progress already made: from this session's transcript and from the spec and ticket files. It only ever adds, and toasts what it picked up.

**Blocked by:** 03, 04

**Status:** done

- [x] Runs at session start and when Feature changes
- [x] Reads typed commands from user messages (`<command-name>` tags or a leading `/name`) and Skill tool uses from assistant messages
- [x] `.scratch/<feature>/spec.md` marks spec done; ticket files mark tickets done; `Status: resolved` or `done` marks that ticket done
- [x] Adds only what advances progress; never removes; toasts "Picked up: …" when anything was added
- [x] Fills Feature from a spec folder when Feature is empty
