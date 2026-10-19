import type { FlowId, Project, Run, StepId, Ticket } from '../types'

export type Step = {
  id: StepId
  label: string
  hint: string
  isOptional?: true
}

export type Flow = { id: FlowId; label: string; summary: string; steps: readonly Step[] }

export type Status = 'done' | 'skipped' | 'current' | 'todo'

const GRILL: Step = { id: 'grill', label: 'Grill', hint: 'Get interviewed about the plan. Decisions land in the glossary and ADRs.' }
const PROTOTYPE: Step = { id: 'prototype', label: 'Prototype', hint: 'Settle a question that needs runnable code.', isOptional: true }
const SPEC: Step = { id: 'spec', label: 'Spec', hint: 'When the interview ends, turn it into a spec in this same window.' }
const REVIEW: Step = { id: 'review', label: 'Review', hint: "Check the diff against the repo's standards and the spec." }
const RETRO: Step = { id: 'retro', label: 'Retro', hint: 'Run it before you /clear, in the session it looks back on.' }

export const FLOWS: readonly Flow[] = [
  {
    id: 'full',
    label: 'Full',
    summary: 'Builds that span sessions: spec, tickets, one /implement per ticket.',
    steps: [
      GRILL,
      PROTOTYPE,
      SPEC,
      { id: 'tickets', label: 'Tickets', hint: "Split the spec into tickets. Stay in this context window until it's done." },
      { id: 'implement', label: 'Implement', hint: 'Run /clear first: each ticket starts fresh.' },
      REVIEW,
      RETRO,
    ],
  },
  {
    id: 'quick',
    label: 'Quick',
    summary: 'Fits one session: spec, then implement straight away.',
    steps: [
      GRILL,
      PROTOTYPE,
      SPEC,
      { id: 'implement', label: 'Implement', hint: 'Build it test-first, in this same window.' },
      REVIEW,
      RETRO,
    ],
  },
  {
    id: 'bug',
    label: 'Bug',
    summary: 'Something is broken: diagnose it, then ask what would have prevented it.',
    steps: [
      { id: 'diagnose', label: 'Diagnose', hint: 'No theories until one command goes red on this bug.' },
      { id: 'retro', label: 'Retro', hint: 'Ask what would have prevented this bug, in this same session.' },
      { id: 'architecture', label: 'improve architecture', hint: 'When no seam could hold a regression test.', isOptional: true },
    ],
  },
]

export const ALIASES: Readonly<Record<string, StepId>> = {
  'grill-with-docs': 'grill',
  'grill-me': 'grill',
  grilling: 'grill',
  prototype: 'prototype',
  'to-spec': 'spec',
  'to-tickets': 'tickets',
  implement: 'implement',
  'implement-spec': 'implement',
  tdd: 'implement',
  'code-review': 'review',
  retro: 'retro',
  'diagnosing-bugs': 'diagnose',
  'improve-codebase-architecture': 'architecture',
}

const COMMANDS: Record<StepId, string> = {
  grill: '/grill-with-docs',
  prototype: '/prototype',
  spec: '/to-spec',
  tickets: '/to-tickets',
  implement: '/implement',
  review: '/code-review',
  retro: '/retro',
  diagnose: '/diagnosing-bugs',
  architecture: '/improve-codebase-architecture',
}

export const flowById = (id: FlowId): Flow => FLOWS.find(f => f.id === id) ?? FLOWS[0]!

export const isFlowId = (value: string): value is FlowId => FLOWS.some(f => f.id === value)

const STEP_IDS = new Set<string>(FLOWS.flatMap(f => f.steps.map(s => s.id)))

// The built-in aliases plus the setting's `step=name, step=name` entries; unreadable entries are skipped.
export const aliasTable = (setting = ''): Readonly<Record<string, StepId>> => {
  const extra: Record<string, StepId> = {}

  for (const entry of setting.split(',')) {
    const [step = '', name = ''] = entry.split('=').map(part => part.trim().toLowerCase())

    if (STEP_IDS.has(step) && name !== '') {
      extra[name.split(':').at(-1)!] = step as StepId
    }
  }

  return { ...ALIASES, ...extra }
}

export type Invocation = { step: StepId; name: string; args: string }

// A skill or slash command as the step it does, or undefined when it is not part of any flow.
export const parseInvocation = (
  command: string,
  args: string,
  aliases: Readonly<Record<string, StepId>> = ALIASES,
): Invocation | undefined => {
  const name = command.trim().replace(/^\//, '').split(':').at(-1)!.toLowerCase()
  const step = aliases[name]

  return step && { step, name, args: args.trim() }
}

// Runs the pane records for a command: `tdd` never marks a ticket, since /implement runs it itself.
const ticketless = (run: Run) => run.name === 'tdd'

type Replay = {
  statuses: Status[]
  tickets: Map<string, 'done' | 'skipped'>
  builds: number
  // Indexes of the step that was current when a bug was diagnosed mid-flow.
  detours: number[]
}

const isPassed = (status: Status) => status === 'done' || status === 'skipped'

export type Progress = {
  flow: Flow
  statuses: Status[]
  current: number | undefined
  ticketState: ReadonlyMap<string, 'done' | 'skipped'>
  builds: number
  detours: number[]
  nextTicket: Ticket | undefined
}

const implementDone = (project: Project, tickets: readonly Ticket[], r: Pick<Replay, 'tickets' | 'builds'>) => {
  if (project.flow !== 'full') {
    return r.builds > 0
  }

  if (tickets.length > 0) {
    return tickets.every(t => r.tickets.has(t.id))
  }

  return project.ticketCount > 0 ? r.builds >= project.ticketCount : r.builds > 0
}

const frontier = (tickets: readonly Ticket[], state: ReadonlyMap<string, unknown>) => {
  const open = tickets.filter(t => !state.has(t.id))

  const isDone = (n: number) => {
    const blocker = tickets.find(t => Number(t.id) === n)

    return blocker === undefined || state.has(blocker.id)
  }

  return open.find(t => t.blockedBy.every(isDone)) ?? open[0]
}

export const progress = (project: Project, tickets: readonly Ticket[] = []): Progress => {
  const flow = flowById(project.flow ?? 'full')
  const { steps } = flow
  const r: Replay = { statuses: steps.map(() => 'todo'), tickets: new Map(), builds: 0, detours: [] }
  const currentIndex = () => steps.findIndex((s, i) => !s.isOptional && !isPassed(r.statuses[i]!))
  const indexOf = (id: StepId) => steps.findIndex(s => s.id === id)
  const passTo = (found: number, as: 'skipped' | 'done') => {
    for (let i = 0; i < found; i++) {
      if (!steps[i]!.isOptional && r.statuses[i] === 'todo') {
        r.statuses[i] = as
      }
    }
  }
  const settleImplement = (i: number) => {
    r.statuses[i] = implementDone(project, tickets, r) ? 'done' : 'todo'
  }

  for (const run of project.runs) {
    if (run.step === 'skip') {
      const at = currentIndex()

      if (at < 0) {
        continue
      }

      const ticket = steps[at]!.id === 'implement' && project.flow === 'full' ? frontier(tickets, r.tickets) : undefined

      if (ticket) {
        r.tickets.set(ticket.id, 'skipped')
        settleImplement(at)
      } else {
        r.statuses[at] = 'skipped'
      }

      continue
    }

    const i = indexOf(run.step)

    if (i < 0) {
      if (run.step === 'diagnose') {
        const at = currentIndex()
        r.detours.push(at < 0 ? steps.length - 1 : at)
      }

      continue
    }

    const step = steps[i]!

    if (run.by === 'hand') {
      if (run.ticket !== undefined) {
        run.undo ? r.tickets.delete(run.ticket) : r.tickets.set(run.ticket, 'done')
        settleImplement(i)
      } else if (step.isOptional) {
        r.statuses[i] = run.undo ? 'todo' : 'done'
      } else if (run.undo) {
        r.statuses[i] = 'todo'

        if (step.id === 'implement') {
          r.tickets.clear()
          r.builds = 0
        }
      } else {
        // Marking a step by hand marks the steps before it too, except those skipped on purpose.
        steps.forEach((s, j) => {
          if (s.isOptional || j > i || (j < i && r.statuses[j] !== 'todo')) {
            return
          }

          r.statuses[j] = 'done'

          if (s.id === 'implement') {
            tickets.forEach(t => r.tickets.has(t.id) || r.tickets.set(t.id, 'done'))
            r.builds = Math.max(r.builds, project.ticketCount, 1)
          }
        })
      }

      continue
    }

    if (step.id === 'review') {
      const implement = indexOf('implement')

      if (implement >= 0 && r.statuses[implement] !== 'done') {
        continue
      }
    }

    if (step.isOptional) {
      r.statuses[i] = 'done'
      continue
    }

    passTo(i, 'skipped')

    if (step.id === 'implement') {
      if (run.ticket === '*') {
        tickets.forEach(t => r.tickets.set(t.id, 'done'))
        r.builds = Math.max(r.builds + 1, project.ticketCount)
      } else if (run.ticket !== undefined) {
        r.tickets.set(run.ticket, 'done')
      } else if (!ticketless(run) || r.builds === 0) {
        r.builds += ticketless(run) && tickets.length > 0 ? 0 : 1
      }

      settleImplement(i)
      continue
    }

    r.statuses[i] = 'done'
  }

  const at = currentIndex()

  if (at >= 0) {
    r.statuses[at] = 'current'
  }

  return {
    flow,
    statuses: r.statuses,
    current: at < 0 ? undefined : at,
    ticketState: r.tickets,
    builds: r.builds,
    detours: r.detours,
    nextTicket: project.flow === 'full' ? frontier(tickets, r.tickets) : undefined,
  }
}

export type Row =
  | { kind: 'step'; step: StepId; label: string; status: Status; count?: string }
  | { kind: 'optional'; step: StepId; label: string; isDone: boolean }
  | { kind: 'ticket'; id: string; title: string; status: Status }
  | { kind: 'detour'; label: string }

export type Next = {
  step: Step
  heading: string
  // "Step n of m", beside the heading.
  meta?: string
  // A line under the heading: which ticket of how many.
  sub?: string
  command: string
  hint: string
  skipLabel: string
  ticket?: Ticket
}

export type Summary = {
  flow: Flow
  rows: Row[]
  next: Next | undefined
  isComplete: boolean
  stepNumber: number
  requiredTotal: number
  requiredDone: number
  // How much of the flow is done, 0 to 1, implement counting ticket by ticket.
  fraction: number
  tickets: { done: number; total: number }
}

export const commandFor = (id: StepId, project: Pick<Project, 'base'>, ticket?: Ticket) => {
  if (id === 'implement' && ticket) {
    return `${COMMANDS.implement} ${ticket.path}`
  }

  return id === 'review' ? `${COMMANDS.review} ${project.base.trim() || 'main'}` : COMMANDS[id]
}

export const summarize = (project: Project, tickets: readonly Ticket[] = []): Summary => {
  const p = progress(project, tickets)
  const { steps } = p.flow
  const isFull = project.flow === 'full'
  const total = isFull ? tickets.length || project.ticketCount : 0
  const doneTickets = tickets.length > 0 ? tickets.filter(t => p.ticketState.has(t.id)).length : Math.min(p.builds, total)
  const required = steps.flatMap((s, i) => (s.isOptional ? [] : [p.statuses[i]!]))
  const passed = required.filter(isPassed).length
  const partial =
    p.current !== undefined && steps[p.current]!.id === 'implement' && total > 0 ? doneTickets / total : 0
  const rows: Row[] = []

  steps.forEach((step, i) => {
    const status = p.statuses[i]!

    if (step.isOptional) {
      rows.push({ kind: 'optional', step: step.id, label: step.label.toLowerCase(), isDone: status === 'done' })
    } else {
      const count = step.id === 'implement' && total > 0 ? `${doneTickets} of ${total} done` : undefined
      rows.push({ kind: 'step', step: step.id, label: step.label, status, ...(count && { count }) })

      if (step.id === 'implement' && status === 'current') {
        tickets.forEach(t => {
          const state = p.ticketState.get(t.id)
          rows.push({
            kind: 'ticket',
            id: t.id,
            title: t.title,
            status: state ?? (t.id === p.nextTicket?.id ? 'current' : 'todo'),
          })
        })
      }
    }

    p.detours.filter(d => d === i).forEach(() => rows.push({ kind: 'detour', label: 'Diagnosed a bug' }))
  })

  const stepNumber = Math.min(passed + 1, required.length)
  const step = p.current === undefined ? undefined : steps[p.current]
  let next: Next | undefined

  if (step) {
    const ticket = step.id === 'implement' ? p.nextTicket : undefined
    const base = {
      step,
      command: commandFor(step.id, project, ticket),
      hint: step.hint,
      skipLabel: step.id === 'implement' && isFull && total > 0 ? 'Skip ticket' : 'Skip step',
    }

    if (ticket) {
      next = {
        ...base,
        heading: `${ticket.id} ${ticket.title}`,
        sub: `Implement · ticket ${doneTickets + 1} of ${total}`,
        ticket,
      }
    } else {
      next = {
        ...base,
        heading: step.label,
        meta: `Step ${stepNumber} of ${required.length}`,
        ...(step.id === 'implement' && isFull && total > 0 && { sub: `Ticket ${Math.min(doneTickets + 1, total)} of ${total}` }),
      }
    }
  }

  return {
    flow: p.flow,
    rows,
    next,
    isComplete: step === undefined,
    stepNumber,
    requiredTotal: required.length,
    requiredDone: passed,
    fraction: required.length === 0 ? 0 : (passed + partial) / required.length,
    tickets: { done: doneTickets, total },
  }
}

// A ticket file as the pane lists it, or undefined for a file that is not a numbered ticket.
export const parseTicket = (dir: string, file: string, text: string): Ticket | undefined => {
  const match = /^(\d+)-(.+)\.md$/.exec(file)

  if (!match) {
    return undefined
  }

  const [, id = '', slug = ''] = match
  const heading = /^#\s+\d+\s*[:.-]\s*(.+?)\s*$/m.exec(text)?.[1]
  const blockers = /^.*blocked by\b.*$/im.exec(text)?.[0].replace(/^.*?blocked by\W*/i, '') ?? ''

  return {
    id,
    title: heading ?? slug.replace(/-/g, ' '),
    path: `${dir}/${file}`,
    blockedBy: [...blockers.matchAll(/\b\d+\b/g)].map(m => Number(m[0])),
    status: /^\W*status\W*(.+?)\s*$/im.exec(text)?.[1]?.toLowerCase() ?? '',
  }
}

// The ticket an /implement run builds: the one its argument names, else the next one; `*` for all of them.
export const resolveTicket = (invocation: Invocation, project: Project, tickets: readonly Ticket[]) => {
  if (tickets.length === 0 || invocation.step !== 'implement' || invocation.name === 'tdd') {
    return undefined
  }

  if (invocation.name === 'implement-spec') {
    return '*'
  }

  const named = /(?:^|[\s/#])0*(\d+)(?=$|[-\s.])/.exec(invocation.args)?.[1]
  const ticket = named === undefined ? undefined : tickets.find(t => Number(t.id) === Number(named))

  return ticket?.id ?? progress(project, tickets).nextTicket?.id
}

// A transcript message as `$.session.messages()` returns it, as far as catch-up reads it.
export type Message = {
  role: 'user' | 'assistant'
  text: string
  toolUses: readonly { tool: string; input: Record<string, unknown> }[]
}

// The slash commands typed and the skills invoked in a transcript, in order.
const invocationsIn = (messages: readonly Message[], aliases: Readonly<Record<string, StepId>>) =>
  messages.flatMap(m => {
    if (m.role === 'user') {
      const tagged = /<command-name>\s*\/?([^<\s]+)\s*<\/command-name>/.exec(m.text)
      const [name, args] = tagged
        ? [tagged[1]!, /<command-args>([\s\S]*?)<\/command-args>/.exec(m.text)?.[1] ?? '']
        : (/^\/(\S+)[ \t]*(.*)/.exec(m.text.trim())?.slice(1) ?? [])
      const found = name === undefined ? undefined : parseInvocation(name, args ?? '', aliases)

      return found ? [found] : []
    }

    return m.toolUses.flatMap(use => {
      const found =
        use.tool === 'Skill' && typeof use.input.skill === 'string'
          ? parseInvocation(use.input.skill, typeof use.input.args === 'string' ? use.input.args : '', aliases)
          : undefined

      return found ? [found] : []
    })
  })

const DONE_STATUSES = new Set(['resolved', 'done', 'closed', 'complete', 'completed'])

const score = (s: Summary) =>
  s.requiredDone * 10_000 + s.tickets.done * 10 + s.rows.filter(r => r.kind === 'optional' && r.isDone).length

// Progress made before the pane was watching, from the transcript and the feature's files. It only ever adds.
export const catchUp = (
  project: Project,
  tickets: readonly Ticket[],
  found: { messages: readonly Message[]; hasSpec: boolean },
  aliases: Readonly<Record<string, StepId>> = ALIASES,
): { project: Project; picked: string[] } => {
  const candidates: Run[] = []

  for (const invocation of invocationsIn(found.messages, aliases)) {
    if (invocation.step === 'diagnose' || invocation.name === 'tdd') {
      continue
    }

    if (invocation.step === 'implement' && tickets.length > 0) {
      // Only a reference names its ticket for sure; a bare /implement may already be counted.
      const named = invocation.name === 'implement-spec' ? '*' : /(?:^|[\s/#])0*(\d+)(?=$|[-\s.])/.exec(invocation.args)?.[1]
      const id = named === '*' ? '*' : tickets.find(t => named !== undefined && Number(t.id) === Number(named))?.id

      if (id !== undefined) {
        candidates.push({ step: 'implement', name: invocation.name, ticket: id, by: 'catch-up' })
      }

      continue
    }

    if (invocation.step === 'implement' && project.flow === 'full') {
      continue
    }

    candidates.push({ step: invocation.step, name: invocation.name, by: 'catch-up' })
  }

  if (found.hasSpec) {
    candidates.push({ step: 'spec', name: 'to-spec', by: 'catch-up' })
  }

  if (tickets.length > 0) {
    candidates.push({ step: 'tickets', name: 'to-tickets', by: 'catch-up' })
  }

  for (const t of tickets.filter(t => DONE_STATUSES.has(t.status))) {
    candidates.push({ step: 'implement', name: 'implement', ticket: t.id, by: 'catch-up' })
  }

  let current: Project = project
  const picked: string[] = []
  let ticketsPicked = 0

  for (const run of candidates) {
    const trial: Project = { ...current, flow: current.flow ?? 'full', runs: [...current.runs, run] }
    const before = summarize(current, tickets)
    const after = summarize(trial, tickets)

    if (score(after) <= score(before)) {
      continue
    }

    current = trial

    if (run.ticket !== undefined) {
      ticketsPicked += after.tickets.done - before.tickets.done
    } else {
      const label = after.flow.steps.find(s => s.id === run.step)?.label ?? run.step
      picked.includes(label) || picked.push(label)
    }
  }

  if (ticketsPicked > 0) {
    picked.push(`${ticketsPicked} ticket${ticketsPicked === 1 ? '' : 's'}`)
  }

  return { project: current, picked }
}

const STARTERS = new Set<StepId>(['grill', 'prototype', 'spec', 'tickets', 'implement', 'review', 'retro'])

// Applies one run of a command to the project: picks a flow when needed and says what to toast.
export const record = (
  project: Project,
  invocation: Invocation,
  tickets: readonly Ticket[],
  ticket?: string,
): { project: Project; toast?: string } => {
  const run: Run = { step: invocation.step, name: invocation.name, ...(ticket !== undefined && { ticket }) }
  const before = project.flow === null ? undefined : summarize(project, tickets)

  if (invocation.step === 'diagnose' && project.flow !== 'bug' && (before === undefined || before.isComplete)) {
    const after = { ...project, flow: 'bug' as const, runs: [run] }

    return { project: after, toast: toastFor(undefined, summarize(after, tickets)) }
  }

  if (project.flow === null && !STARTERS.has(invocation.step)) {
    return { project }
  }

  const after: Project = { ...project, flow: project.flow ?? 'full', runs: [...project.runs, run].slice(-200) }
  const summary = summarize(after, tickets)

  if (invocation.step === 'diagnose' && project.flow !== 'bug') {
    return { project: after, toast: `Diagnosed a bug. Back to: ${summary.next?.heading.toLowerCase() ?? 'the flow'}` }
  }

  return { project: after, toast: toastFor(before, summary) }
}

const toastFor = (before: Summary | undefined, after: Summary) => {
  const doneBefore = before?.requiredDone ?? 0
  const ticketsBefore = before?.tickets.done ?? 0

  if (before?.isComplete) {
    return undefined
  }

  if (after.requiredDone > doneBefore) {
    const label = before?.next?.step.label ?? after.flow.steps[0]!.label

    return after.next ? `${label} done. Next: ${after.next.heading.toLowerCase()}` : `${label} done. Flow complete`
  }

  if (after.tickets.done > ticketsBefore && before?.next?.ticket) {
    return `Ticket ${before.next.ticket.id} done. Next: ${after.next?.heading ?? 'review'}`
  }

  return undefined
}

const MARKS: Record<Status, string> = { done: '✓', current: '●', skipped: '–', todo: '○' }

// The flow as plain text, for surfaces that cannot draw the pane.
export const describeFlow = (project: Project, tickets: readonly Ticket[] = []): string => {
  if (project.flow === null) {
    return [
      'No flow chosen. Pick one, or start with /grill-with-docs (it picks Full):',
      ...FLOWS.map(f => `  /main-flow ${f.id}  ${f.summary}`),
    ].join('\n')
  }

  const s = summarize(project, tickets)
  const head = `${s.flow.label}${project.feature === '' ? '' : `: ${project.feature}`}`
  const list = s.rows.map(row => {
    switch (row.kind) {
      case 'step':
        return `  ${MARKS[row.status]} ${row.label}${row.status === 'skipped' ? ' (skipped)' : ''}${row.count ? `  ${row.count}` : ''}`
      case 'optional':
        return `    + Optional: ${row.isDone ? '✓ ' : ''}${row.label}`
      case 'ticket':
        return `      ${MARKS[row.status]} ${row.id} ${row.title}`
      case 'detour':
        return `    ${row.label}`
    }
  })

  if (s.next === undefined) {
    return [head, '', 'Flow complete. /main-flow reset to start again.', '', ...list].join('\n')
  }

  const place = s.next.meta ? ` (${s.next.meta.toLowerCase()})` : s.next.sub ? ` (${s.next.sub.toLowerCase()})` : ''

  return [head, '', `Next: ${s.next.heading}${place}`, `  ${s.next.command}`, `  ${s.next.hint}`, '', ...list].join('\n')
}
