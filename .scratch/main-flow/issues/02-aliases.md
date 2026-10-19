# 02: Aliases

**What to build:** Any of a step's names counts as that step, with or without a plugin prefix, and the person can add their own names in the mod's settings.

**Blocked by:** 01

**Status:** ready-for-agent

- [ ] `mattpocock-skills:grilling` counts the same as `grilling`
- [ ] Built-in aliases: grill = grill-with-docs, grill-me, grilling; implement = implement, implement-spec, tdd; spec = to-spec; tickets = to-tickets; review = code-review; retro = retro; prototype = prototype
- [ ] A `userConfig` string field `aliases` in the form `step=name, step=name` adds names; malformed entries are ignored
