# 01: Flows, runs and the pane

**What to build:** Installing the mod gives a Main flow pane and a `/main-flow` command. Choosing Full or Quick shows the next step's command, ready to copy; typing a main-flow slash command, or Claude invoking the skill, marks the step done and advances the pane with a toast. Where no pane can be placed, `/main-flow` prints the same as text.

**Blocked by:** None (can start immediately)

**Status:** ready-for-agent

- [ ] Manifest, marketplace file, hooks list, state contract and tsconfig in the template's structure; `claude plugin validate` passes and `tsc` type-checks
- [ ] Full (grill, spec, tickets, implement, review, retro) and Quick (grill, spec, implement, review, retro) flows, with an optional prototype row after grill
- [ ] Typed slash commands and successful Skill calls record runs; failed or denied Skill calls do not
- [ ] The first main-flow command with no flow chosen picks Full; switching flows recomputes progress from the runs
- [ ] Next-step card: name, "Step n of m", command in a code block, the step's hint line, full-width Copy command, quiet Skip step
- [ ] Progress bar (text bar in the terminal), step list with ✓ ● ○ –, toast on completion, Start again and Reset
- [ ] No-flow state describes both flows and offers `/grill-with-docs` with Copy
- [ ] Mobile shows flow buttons instead of the dropdown
- [ ] `/main-flow`, `/main-flow full|quick|reset`; text output when the pane is not placed
