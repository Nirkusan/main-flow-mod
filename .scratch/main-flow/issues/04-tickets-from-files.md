# 04: Tickets from files

**What to build:** On a Full build, the Implement step tracks real tickets read from `.scratch/<feature>/issues/`: the card leads with the next ticket and its ready-to-run command, every ticket is a row under Implement, and each `/implement` marks the right ticket.

**Blocked by:** 01

**Status:** done

- [x] Feature field; filled in when `.scratch/` holds exactly one folder with an `issues/` subfolder
- [x] Tickets scanned at session start, after `/to-tickets` or `/implement`, and when Feature changes; titles from `# NN: Title`
- [x] Implement card: "03 Pay button", then "Implement · ticket 3 of 8", then `/implement .scratch/<feature>/issues/03-pay-button.md`, hint "Run /clear first: each ticket starts fresh.", Copy, Skip ticket
- [x] `/implement <ref>` resolves by number, file name, path ending or `#NN`; a bare `/implement` marks the next undone ticket; `/implement-spec` marks all
- [x] Next ticket: lowest-numbered undone ticket whose `Blocked by:` tickets are done
- [x] Ticket rows under Implement while it is current ("2 of 8 done" on the Implement row); collapsed to the count once done
- [x] Progress bar fills ticket by ticket
- [x] Editing Feature while progress exists shows "New feature clears progress." Clear / Keep
- [x] Mobile shows Feature as read-only text
