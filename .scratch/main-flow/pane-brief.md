# Pane brief (impeccable shape)

**Job and audience.** A developer mid-build glances at the pane to learn the next main-flow command. Operate mode: the pane is a tool, its controls the host's standard ones.

**Outcome.** The next command, ready to copy, in under a second. Success: the person never asks "what now?", "which ticket?" or "should I /clear?".

**Direction.** Inherit the impeccable-flow pane (the established world): host-drawn elements, `claude` accent for the current step and the primary button, dim for done and secondary. Signature move: tickets nested under the Implement row of the step list, with the progress bar filling by ticket as well as by step.

**Layout, top to bottom.**
1. Flow dropdown (Full, Quick) and a quiet Reset.
2. Feature field. Changing it while progress exists shows an inline confirm row: "New feature clears progress." Clear / Keep.
3. Next-step card:
   - Heading: the step name and "Step n of m". On Implement with tickets, the heading is the ticket ("03 Pay button") with "Implement · ticket 3 of 8" beneath.
   - Review only: a Base field (default `main`) inside the card.
   - The command in a code block, wrapped, with every argument filled in.
   - One hint line: what the step does, or the context rule that applies there ("Run /clear first: each ticket starts fresh.").
   - Full-width primary Copy command; a quiet Skip step (Skip ticket on Implement).
4. Progress bar over the required steps, with Implement filling ticket by ticket.
5. Step list: ✓ done (dim), ● current (accent, semibold), ○ to do, – skipped (dim, struck). The optional prototype sits on one dim row after Grill. Under Implement, every ticket is a row (✓ dim, ● current, ○ to do), and tapping one marks it done or undone.

**States.**
- No flow chosen: the dropdown, one line on each flow, and a start card with `/grill-with-docs` and Copy (running it picks Full).
- No ticket files found (GitHub tracker): a Tickets count field in the Implement card; the rows read "Ticket 1…n".
- Flow complete: "Flow complete", one line, Start again (keeps Feature).
- Mobile: flow buttons instead of the dropdown, Feature and Base as read-only text, no ticket count field (count shown as text).
- Terminal: a text progress bar in place of the Svg bar.

**Copy rules.** Use the flow's own words (ticket, spec, base). One hint line per step. No eyebrows, no section numbers beyond ticket numbers, which carry meaning.

**Ranges.** 0–30 tickets; titles up to about 40 characters (wrap, never truncate the command); feature slugs up to about 24 characters.
