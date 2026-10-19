# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

A Claude Code mod: a hooks module (TypeScript/TSX) whose pane is drawn from the host's own element table (Box, Text, Button, Code, Input, Select, Svg). The host draws and themes every element; the mod chooses structure, copy, emphasis and the one host accent colour (`claude`).

## Users

Developers who build with Matt Pocock's skills in Claude Code. They are mid-build, in a terminal or the desktop app, switching between the conversation and their code. They glance at the pane to answer one question: what do I run next?

## Product Purpose

A side pane that tracks where the person is in "the main flow" (grill, spec, tickets, implement, review, retro) and hands them the next command, ready to copy. Success is never having to remember which skill comes next, which ticket is next, or when to `/clear`.

## Positioning

It knows the main flow's real rules: the Full and Quick branches, one `/implement` per ticket read from the tracker's ticket files, that `/implement` runs its own code review, and the context-window rules between steps. A generic checklist cannot.

## Operating Context

- Runs beside the conversation in a pane about 252px wide (34 columns in the terminal).
- Steps are marked by the person typing a slash command or by Claude invoking the skill.
- Tickets live in `.scratch/<feature>/issues/NN-slug.md` with a `# NN: Title` line, or on GitHub, where only a count is known.
- Progress outlives `/clear` and sessions, per project.
- Cloud sessions draw no pane; `/main-flow` prints the same information as text.

## Capabilities and Constraints

- Surfaces: terminal (no Svg), desktop, vscode, mobile (no Input or Select). Branch on the surface, not on whether an element exists.
- Colour is limited to the host's theme, `dimColor`, and the `claude` accent; no custom palette.
- Terminology follows CONTEXT.md: Flow, Step, Run, Ticket, Feature, Base, Alias, Project.

## Brand Commitments

Same family as the impeccable-flow mod: the next step on top (name, "Step n of m", the command in a code block, full-width Copy, a quiet Skip step), a progress bar, the step list marked ✓ ● ○ –, a toast when a step completes, Start again and Reset.

## Product Principles

1. The next command is the product; everything else supports it.
2. Never mark a step done early; when unsure, let the person skip or toggle.
3. Speak the flow's own words (ticket, spec, base), not generic task language.
4. A glance, not a read: one line of hint per step, no paragraphs.
