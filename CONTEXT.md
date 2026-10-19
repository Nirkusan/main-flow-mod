# Main flow

The vocabulary of the main-flow mod: a pane that tracks where you are in Matt Pocock's idea-to-ship flow and names the next command.

## Language

**Flow**:
An ordered list of steps from idea to ship. There are two: Full and Quick.
_Avoid_: workflow, pipeline

**Full flow**:
The flow for a build that spans sessions: grill, spec, tickets, implement, review, retro.

**Quick flow**:
The flow for a build that fits one session: grill, spec, implement, review, retro. It has no tickets.

**Step**:
One stage of a flow, done by running one of its commands.

**Run**:
One recorded use of a main-flow command, whether you typed it or Claude invoked the skill.

**Ticket**:
One buildable slice of a spec, produced by `/to-tickets` and built by one `/implement`.
_Avoid_: issue, task (an issue is where a ticket lives on a tracker, not the ticket itself)

**Feature**:
The short name of what is being built, such as `checkout`. In the Full flow it names the folder the tickets live in.
_Avoid_: target (each step takes a different argument, so no one target fits)

**Base**:
The fixed point a code review compares against, `main` unless changed.

**Alias**:
Another skill name that counts as a step's command, such as `grilling` for the grill step.

**Catch-up**:
Finding progress made before the pane was watching (earlier in the transcript, or in the spec and ticket files) and adding it. Catch-up only ever adds; it never undoes a step.

**Project**:
The folder a session runs in. Progress belongs to a project and outlives the session.

## Relationships

- A **Project** has at most one **Flow** in progress.
- A **Flow** has many **Steps**; a **Step** is done by a **Run** of one of its commands.
- In the **Full flow**, the implement **Step** is done when every **Ticket** has been implemented.
- A **Feature** has one spec and, in the **Full flow**, many **Tickets**.

## Flagged ambiguities

- "Implement" meant both the step and one `/implement` call. Resolved: the **Step** is implement; one call implements one **Ticket**.
