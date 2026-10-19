# 05: Marking by hand

**What to build:** The person can set their place by hand: tap a ticket row to toggle it, tap a step to mark it and everything before it done (or a done step to undo it), and set a ticket count when there are no ticket files.

**Blocked by:** 04

**Status:** done

- [x] Tapping a ticket row toggles it done or undone
- [x] Tapping a required step marks it and every earlier step done; tapping a done step undoes it
- [x] With no ticket files, the Implement card shows a Tickets count field (text on mobile) and "Ticket n of m"; the Implement row shows "n of m done"; a bare `/implement` or Skip ticket passes the next one
  - Changed at review: no per-ticket rows without files, since there are no titles to show and nothing to toggle by name.
