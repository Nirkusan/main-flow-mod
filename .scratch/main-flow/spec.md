# Spec: main-flow mod

Status: ready-for-agent

## Problem Statement

Matt Pocock's main flow (grill, spec, tickets, implement, review, retro) has branches and rules that are easy to lose track of mid-build: which skill comes next, which ticket is next, whether this build needs a spec and tickets at all, when to `/clear`, and that `/implement` already runs its own code review. Builds span sessions and `/clear`s, so nothing in the conversation remembers where the person is. When someone installs a helper mid-build, it should not make them start over.

## Solution

A Claude Code mod, `main-flow`, that shows a side pane naming the next main-flow command (or, in the Bug flow, the next bug-hunt command), ready to copy, with the arguments filled in. It records each step as the person types the slash command or as Claude invokes the skill, follows the Full and Quick branches, tracks tickets one by one from the tracker's ticket files, and keeps progress per project across `/clear` and sessions. It catches up on progress made before it was watching, from the transcript and from the spec and ticket files. Where no pane can be drawn (cloud sessions), `/main-flow` prints the same information as text.

## User Stories

1. As a developer, I want a pane that names the next main-flow command, so that I never have to remember which skill comes next.
2. As a developer, I want to copy the next command with one press, so that running it takes no typing.
3. As a developer, I want to choose between a Full flow and a Quick flow, so that the pane matches whether my build spans sessions.
4. As a developer on a Full build, I want the steps grill, spec, tickets, implement, review, retro, so that the pane follows Matt's multi-session route.
5. As a developer on a Quick build, I want the steps grill, spec, implement, review, retro, so that the pane skips tickets I don't need.
6. As a developer, I want the first main-flow command I run with no flow chosen to pick Full, so that I can start without touching the pane.
7. As a developer, I want to switch flows at any time and have progress recomputed from what I've run, so that a wrong first guess costs nothing.
8. As a developer, I want a step marked done when I type its slash command, so that the pane follows me.
9. As a developer, I want a step marked done when Claude invokes the skill through the Skill tool, so that steps Claude starts count too.
10. As a developer with a namespaced install, I want `mattpocock-skills:grilling` to count the same as `grilling`, so that plugin installs work.
11. As a developer, I want `grill-with-docs`, `grill-me` and `grilling` all to count as the grill step, so that whichever interview I use is recognised.
12. As a developer, I want `implement`, `implement-spec` and `tdd` to count toward the implement step, so that each way of building is recognised.
13. As a developer with renamed or forked skills, I want to add my own aliases in the mod's settings, so that the pane recognises them without a release.
14. As a developer, I want an optional prototype row after grill, so that the prototype detour is visible but never required.
15. As a developer, I want a quiet Skip step, so that I can pass over a step I chose not to run.
16. As a developer, I want a toast when a step completes, naming the next one, so that I notice progress without looking at the pane.
17. As a developer, I want a progress bar over the required steps, filling ticket by ticket during implement, so that I can see how far along I am.
18. As a developer, I want a step list marked ✓ done, ● current, ○ to do and – skipped, so that I can see the whole route at a glance.
19. As a developer on a Full build, I want every ticket listed under Implement while it is the current step, so that I can see which tickets remain.
20. As a developer, I want the ticket list read from `.scratch/<feature>/issues/*.md`, with titles from each file's `# NN: Title` line, so that the pane shows the real tickets.
21. As a developer, I want the next ticket to be the lowest-numbered undone ticket whose blockers are all done, so that I work the frontier in order.
22. As a developer, I want `/implement <ref>` to mark the ticket it names, by number, file name, path or `#issue`, so that tickets I build out of order are tracked.
23. As a developer, I want a bare `/implement` to mark the next undone ticket, so that the common case needs no argument.
24. As a developer, I want `/implement-spec` to mark every ticket done, so that a parallel build completes the step.
25. As a developer, I want to tap a ticket row to mark it done or undone, so that I can fix the record by hand.
26. As a developer on GitHub issues, I want to set the ticket count myself when no ticket files exist, so that ticket tracking still works.
27. As a developer, I want the Implement card to lead with the ticket's number and title, then "Implement · ticket n of m", so that I know exactly what I'm building.
28. As a developer, I want the implement command to name the ticket's file, so that the copied command is ready to run.
29. As a developer, I want a `code-review` during implement to count as part of implement, not as the review step, so that per-ticket reviews don't jump the flow ahead.
30. As a developer, I want the code review run after the last ticket (including the one `/implement` runs itself) to complete the review step, so that I'm not asked to review twice.
31. As a developer, I want a Feature field holding the feature's slug, so that commands and ticket lookups use it.
32. As a developer, I want Feature filled in automatically when `.scratch/` holds exactly one feature folder, so that I rarely type it.
33. As a developer, I want a confirm row before a new Feature clears progress, so that a typo doesn't wipe my place.
34. As a developer, I want a Base field (default `main`) in the Review card, so that `/code-review main` is ready to copy and the field stays out of the way elsewhere.
35. As a developer, I want each step's hint line to carry the context rule that applies there ("Run /clear first: each ticket starts fresh"), so that I follow the flow's context hygiene.
36. As a developer, I want progress kept per project across `/clear`, so that per-ticket `/clear`s don't wipe the pane.
37. As a developer, I want progress kept across sessions, so that a multi-day build picks up where I left it.
38. As a developer installing mid-build, I want the pane to scan this session's transcript for main-flow commands and Skill calls already run, so that it catches up.
39. As a developer resuming an old session, I want the same catch-up from the resumed transcript, so that the pane matches it.
40. As a developer, I want a spec file at `.scratch/<feature>/spec.md` to mark spec done, so that work done before the mod counts.
41. As a developer, I want ticket files to mark tickets done, and a ticket file whose `Status:` reads resolved or done to mark that ticket done, so that the files and the pane agree.
42. As a developer, I want catch-up only to add progress, never remove it, with a toast saying what it picked up, so that it can't undo my place.
43. As a developer, I want to tap a step in the list to mark it and everything before it done, or tap a done step to undo it, so that I can set my place by hand.
44. As a developer, I want Start again when the flow is complete, keeping Feature, so that the next round starts cleanly.
45. As a developer, I want Reset to clear the flow, progress and Feature, so that I can start from nothing.
46. As a developer with no flow chosen, I want the pane to describe both flows and offer `/grill-with-docs` to copy, so that the first step is obvious.
47. As a developer in a cloud session, I want `/main-flow` to print the flow and the next command as text, so that I get the same guidance without a pane.
48. As a developer, I want `/main-flow full`, `/main-flow quick` and `/main-flow reset`, so that I can drive it from the prompt.
49. As a developer on the mobile app, I want flow buttons in place of the dropdown and Feature and Base shown as text, so that the pane works where inputs aren't drawn.
50. As a developer in the terminal, I want a text progress bar in place of the drawn one, so that the pane works without Svg.
51. As a developer, I want a failed or denied Skill call not to count, so that only real runs advance the flow.
52. As a maintainer, I want the version bumped on each release, so that `claude plugin update` picks up changes.
53. As a developer with something broken, I want a Bug flow, diagnose then retro, so that the pane guides a bug hunt too.
54. As a developer on the Bug flow, I want the diagnose hint to say "No theories until one command goes red on this bug", so that I hold the skill's key rule.
55. As a developer on the Bug flow, I want the retro hint to ask what would have prevented the bug, in the same session, so that the lesson lands while the context is fresh.
56. As a developer whose diagnosis found no good test seam, I want an optional improve-architecture row after retro, so that the follow-up is visible.
57. As a developer mid-build, I want a diagnosis Claude starts on its own to show as a dim detour row and a toast, without moving my flow, so that a bug doesn't cost me my place.
58. As a developer with no flow in progress, or a finished one, I want a diagnosis to switch the pane to the Bug flow, so that a bug hunt is tracked from its first command.

## Implementation Decisions

- **Same structure as the impeccable-flow mod.** A manifest and marketplace file, a hooks list naming one hooks module, a state contract, pure logic in a separate module, and tests run with `claude plugin test`. Validated with `claude plugin validate` and type-checked with `tsc`.
- **One deep, pure module holds the flow logic.** It knows the two flows and their steps, the alias table, how to parse a command name and arguments into a run, how to parse ticket files, how to derive progress, how to build each command, how to read catch-up from transcript messages and files, and how to print the flow as text. Its central function takes the recorded state (flow, runs, ticket marks, feature, base) and the known tickets, and returns everything the pane and the text mode draw: per-step statuses, the next step or ticket and its command and hint, step number and totals, the progress fraction, and the rows of the step list. Nothing in it touches the engine.
- **The hooks module is thin.** It records runs from `prompt.submit` (typed slash commands) and `tool.call` on Skill (after a successful call), scans ticket files with `$.fs`, reads the transcript with `$.session.messages()`, persists with `$.store`, draws the pane, and answers `/main-flow`.
- **State.** Session state (`$.state` atoms) drives drawing; on every write it is mirrored to `$.store` under a key derived from the project folder (`$.session.cwd()`), and restored from there at `session.start`. Recorded per project: flow (`full` | `quick` | null), runs (command, args, source), ticket marks (ids done by hand or by run, ids undone by hand), feature, base, and the ticket count used when no files exist.
- **Three flows.** Full (grill, spec, tickets, implement, review, retro), Quick (grill, spec, implement, review, retro), Bug (diagnose, retro, then an optional improve-architecture). Prototype is optional after grill in Full and Quick. Diagnose is `diagnosing-bugs`; improve architecture is `improve-codebase-architecture`. The Bug flow shows no Feature field.
- **Detours.** A diagnose run while Full or Quick is in progress and not complete leaves the flow where it is: it adds a dim "Diagnosed a bug" row after the step that was current and toasts. With no flow, or a complete one, it picks the Bug flow (starting a fresh run list).
- **Runs, not statuses, are the record.** Progress is always derived from the run list plus ticket marks, which is what lets a flow switch recompute and lets catch-up merge forward by adding runs.
- **Alias resolution.** A skill name is stripped of any `plugin:` prefix, lowercased, then looked up in the built-in table merged with the user's aliases. The user's aliases come from one `userConfig` string field, `aliases`, in the form `step=name, step=name`.
- **Review gating.** A review-step command counts only when the implement step is complete at that moment; otherwise it is ignored for progress.
- **Ticket references.** `/implement` arguments resolve to a ticket by two-digit number, file name, path ending, or `#NN` matched to the number; anything unresolved falls back to the next undone ticket. With no ticket files, a bare `/implement` increments the done count.
- **Ticket order.** The next ticket is the lowest-numbered undone ticket whose `Blocked by:` numbers are all done; if none qualifies, the lowest-numbered undone ticket.
- **Catch-up.** It runs at `session.start` and when Feature changes. It reads typed commands from user messages (the `<command-name>` tag or a leading `/name`) and Skill tool uses from assistant messages, and reads the spec file and ticket files' `Status:` lines. It turns each finding into runs or ticket marks and adds only those that would advance progress, then toasts a one-line summary when anything was added.
- **Steps by hand.** Tapping a required step records a hand-mark run for it and every earlier step; tapping a done step records an undo for that step. Tapping a ticket row toggles its mark.
- **Feature change.** Editing Feature while any progress exists shows an inline confirm (Clear / Keep); Clear empties runs and marks and keeps the new feature. With Feature empty, a single `.scratch/*/issues` folder fills it.
- **Commands built by the pane.** Diagnose `/diagnosing-bugs`; improve architecture `/improve-codebase-architecture`; grill `/grill-with-docs`; prototype `/prototype`; spec `/to-spec`; tickets `/to-tickets`; implement `/implement <ticket file path>` (or `/implement` with no files); review `/code-review <base>`; retro `/retro`.
- **Hint lines carry the context rules.** Spec: "When the interview ends, turn it into a spec in this same window." Tickets: "Split the spec into tickets. Stay in this context window until it's done." Implement (Full): "Run /clear first: each ticket starts fresh." Retro: "Run it before you /clear, in the session it looks back on." Diagnose: "No theories until one command goes red on this bug." Retro (Bug): "Ask what would have prevented this bug, in this same session."
- **Surfaces.** Branch on `e.surface`: mobile draws no Input or Select (buttons and read-only text instead), the terminal draws no Svg (text bar instead).
- **Pane layout** follows the confirmed mockup (`docs/mockup/pane.html`) and brief (`.scratch/main-flow/pane-brief.md`).

## Testing Decisions

- Test external behaviour only: what the pane shows and what `/main-flow` prints after given inputs, never internal helpers' shapes.
- **Seam 1, the pure flow module:** given state and tickets, assert statuses, the next command, the hint, counts and rows. Covers both flows, aliases, review gating, ticket references and order, catch-up parsing, skip, hand marks, flow switching and the text output.
- **Seam 2, the plugin through the engine's test kit:** mount the pane on `terminal`, `desktop` and `mobile`; drive it with `$.tool.call({ tool: 'Skill', skill, args })` and prompt submissions; answer `fs.list`, `fs.read`, `session.messages`, `session.cwd` and `store.get` from test hooks to supply ticket files, transcripts and stored progress.
- Prior art: the impeccable-flow mod's `tests/flows.test.ts` and `tests/pane.test.tsx`.

## Out of Scope

- Reading GitHub issues over the network (ticket count is set by hand there).
- Tracking more than one feature at a time per project.
- The triage and wayfinder on-ramps, and `/handoff` between phases. (Triage's output already merges into implement.)
- Showing diagnosing-bugs' internal phases; the pane only sees that the skill ran.
- Detecting when a grilling interview has ended.
- Running commands for the person; the pane only copies them.

## Further Notes

- aihero.dev was unreachable from the build environment; the flow was taken from `mattpocock/skills` (`ask-matt/SKILL.md` and each step's `SKILL.md`), which the page is built from.
- Most main-flow skills set `disable-model-invocation`, so Claude cannot invoke them; only typed commands mark those steps. Model-invocable ones (grilling, domain-modeling, tdd, code-review, prototype) are also caught as Skill calls.
