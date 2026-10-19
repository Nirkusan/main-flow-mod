import { describe, expect, test } from 'claude-code/testing'

import type { Project, Run } from '../types'
import {
  ALIASES,
  aliasTable,
  catchUp,
  describeFlow,
  parseInvocation,
  parseTicket,
  record,
  resolveTicket,
  summarize,
} from '../hooks/flows'
import type { Ticket } from '../types'

const project = (over: Partial<Project> = {}): Project => ({
  flow: 'full',
  runs: [],
  feature: '',
  base: 'main',
  ticketCount: 0,
  ...over,
})

const ran = (...names: string[]): Run[] =>
  names.map(name => ({ step: parseInvocation(name, '')!.step, name }))

describe('parseInvocation', () => {
  test('reads a main-flow command and its arguments', () => {
    expect(parseInvocation('to-tickets', '.scratch/checkout/spec.md')).toEqual({
      step: 'tickets',
      name: 'to-tickets',
      args: '.scratch/checkout/spec.md',
    })
  })

  test('ignores commands outside the flow', () => {
    expect(parseInvocation('commit', '')).toBeUndefined()
  })

  test('reads a plugin-prefixed skill as its bare name', () => {
    expect(parseInvocation('mattpocock-skills:grilling', '')?.step).toBe('grill')
  })

  test('every interview skill counts as the grill step', () => {
    expect(['grill-with-docs', 'grill-me', 'grilling'].map(n => parseInvocation(n, '')?.step)).toEqual(['grill', 'grill', 'grill'])
  })

  test('every way of building counts as the implement step', () => {
    expect(['implement', 'implement-spec', 'tdd'].map(n => parseInvocation(n, '')?.step)).toEqual([
      'implement',
      'implement',
      'implement',
    ])
  })
})

describe('aliasTable', () => {
  test('adds the names from the setting to the built-in ones', () => {
    const table = aliasTable('implement=build-it, spec = Write-Spec')
    expect(parseInvocation('build-it', '', table)?.step).toBe('implement')
    expect(parseInvocation('write-spec', '', table)?.step).toBe('spec')
    expect(parseInvocation('grilling', '', table)?.step).toBe('grill')
  })

  test('ignores entries it cannot read', () => {
    expect(aliasTable('nonsense, colour=red, =x, review=')).toEqual(ALIASES)
  })
})

describe('summarize', () => {
  test('a fresh Full flow suggests grilling first', () => {
    const s = summarize(project())
    expect(s.next?.command).toBe('/grill-with-docs')
    expect(s.next?.meta).toBe('Step 1 of 6')
  })

  test('Full advances grill, spec, tickets in order', () => {
    const s = summarize(project({ runs: ran('grill-with-docs', 'to-spec') }))
    expect(s.next?.step.id).toBe('tickets')
    expect(s.next?.hint).toMatch(/Stay in this context window/)
    expect(s.requiredDone).toBe(2)
  })

  test('Quick has no tickets step', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec') }))
    expect(s.next?.step.id).toBe('implement')
    expect(s.next?.meta).toBe('Step 3 of 5')
  })

  test('running a later step passes over the ones before it', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('implement') }))
    expect(s.rows.filter(r => r.kind === 'step').map(r => r.kind === 'step' && r.status)).toEqual([
      'skipped',
      'skipped',
      'done',
      'current',
      'todo',
    ])
  })

  test('running a passed-over step later marks it done', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('implement', 'grill-with-docs') }))
    expect(s.rows[0]).toEqual({ kind: 'step', step: 'grill', label: 'Grill', status: 'done' })
  })

  test('prototype is an optional row after grill and never blocks', () => {
    const s = summarize(project({ runs: ran('grill-with-docs', 'prototype') }))
    expect(s.rows[1]).toEqual({ kind: 'optional', step: 'prototype', label: 'prototype', isDone: true })
    expect(s.next?.step.id).toBe('spec')
  })

  test('skip passes the current step without running it', () => {
    const s = summarize(project({ runs: [...ran('grill-with-docs'), { step: 'skip', name: 'skip' }] }))
    expect(s.rows[2]).toMatchObject({ step: 'spec', status: 'skipped' })
    expect(s.next?.step.id).toBe('tickets')
  })

  test('a finished flow has no next step', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec', 'implement', 'code-review', 'retro') }))
    expect(s.isComplete).toBe(true)
    expect(s.next).toBeUndefined()
    expect(s.fraction).toBe(1)
  })
})

describe('record', () => {
  test('the first main-flow command with no flow picks Full', () => {
    const { project: after } = record(project({ flow: null }), parseInvocation('grill-with-docs', '')!, [])
    expect(after.flow).toBe('full')
    expect(after.runs).toHaveLength(1)
  })

  test('completing a step toasts the next one', () => {
    const { toast } = record(project(), parseInvocation('grill-with-docs', '')!, [])
    expect(toast).toBe('Grill done. Next: spec')
  })

  test('completing the last step toasts the end of the flow', () => {
    const before = project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec', 'implement', 'code-review') })
    expect(record(before, parseInvocation('retro', '')!, []).toast).toBe('Retro done. Flow complete')
  })
})

describe('describeFlow', () => {
  test('without a flow it lists the choices and the first command', () => {
    const text = describeFlow(project({ flow: null }))
    expect(text).toContain('/main-flow full')
    expect(text).toContain('/grill-with-docs')
  })

  test('with a flow it puts the next command above the step list', () => {
    const text = describeFlow(project({ runs: ran('grill-with-docs') }))
    expect(text).toContain('Next: Spec (step 2 of 6)')
    expect(text).toContain('  /to-spec')
    expect(text).toContain('✓ Grill')
    expect(text.indexOf('Next:')).toBeLessThan(text.indexOf('✓ Grill'))
  })
})

const ticket = (id: string, title: string, blockedBy: number[] = [], status = 'ready-for-agent'): Ticket => ({
  id,
  title,
  path: `.scratch/checkout/issues/${id}-${title.toLowerCase().replace(/ /g, '-')}.md`,
  blockedBy,
  status,
})

const TICKETS = [ticket('01', 'Cart model'), ticket('02', 'Cart API', [1]), ticket('03', 'Pay button', [2]), ticket('04', 'Receipt email', [1])]

const built = (...ids: string[]): Run[] => ids.map(id => ({ step: 'implement', name: 'implement', ticket: id }))

const atImplement = (runs: Run[] = []) =>
  project({ feature: 'checkout', runs: [...ran('grill-with-docs', 'to-spec', 'to-tickets'), ...runs] })

describe('parseTicket', () => {
  test('reads the number, title, path and blockers of a ticket file', () => {
    const text = '# 03: Pay button\n\n**What to build:** ...\n\n**Blocked by:** 01, 02\n\n**Status:** ready-for-agent\n'
    expect(parseTicket('.scratch/checkout/issues', '03-pay-button.md', text)).toEqual({
      id: '03',
      title: 'Pay button',
      path: '.scratch/checkout/issues/03-pay-button.md',
      blockedBy: [1, 2],
      status: 'ready-for-agent',
    })
  })

  test('falls back to the file name for the title and reads no blockers from None', () => {
    expect(parseTicket('x/issues', '07-promo-codes.md', 'Blocked by: None (can start immediately)')).toMatchObject({
      title: 'promo codes',
      blockedBy: [],
    })
  })

  test('skips files that are not numbered tickets', () => {
    expect(parseTicket('x/issues', 'notes.md', '# Notes')).toBeUndefined()
  })
})

describe('tickets', () => {
  test('the implement card leads with the next ticket and its file', () => {
    const s = summarize(atImplement(), TICKETS)
    expect(s.next?.heading).toBe('01 Cart model')
    expect(s.next?.sub).toBe('Implement · ticket 1 of 4')
    expect(s.next?.command).toBe('/implement .scratch/checkout/issues/01-cart-model.md')
    expect(s.next?.hint).toBe('Run /clear first: each ticket starts fresh.')
    expect(s.next?.skipLabel).toBe('Skip ticket')
  })

  test('the next ticket is the lowest-numbered one whose blockers are done', () => {
    expect(summarize(atImplement(built('01', '04')), TICKETS).next?.ticket?.id).toBe('02')
    expect(summarize(atImplement(built('02', '01')), TICKETS).next?.ticket?.id).toBe('03')
  })

  test('every ticket is a row under Implement while it is current', () => {
    const s = summarize(atImplement(built('01')), TICKETS)
    expect(s.rows.find(r => r.kind === 'step' && r.step === 'implement')).toMatchObject({ status: 'current', count: '1 of 4 done' })
    expect(s.rows.filter(r => r.kind === 'ticket').map(r => r.kind === 'ticket' && r.status)).toEqual(['done', 'current', 'todo', 'todo'])
  })

  test('implement is done when every ticket is, and the rows collapse', () => {
    const s = summarize(atImplement(built('01', '02', '03', '04')), TICKETS)
    expect(s.next?.step.id).toBe('review')
    expect(s.rows.some(r => r.kind === 'ticket')).toBe(false)
    expect(s.rows.find(r => r.kind === 'step' && r.step === 'implement')).toMatchObject({ status: 'done', count: '4 of 4 done' })
  })

  test('implement-spec builds every ticket', () => {
    const s = summarize(atImplement([{ step: 'implement', name: 'implement-spec', ticket: '*' }]), TICKETS)
    expect(s.next?.step.id).toBe('review')
  })

  test('tdd, which /implement runs itself, never marks a ticket', () => {
    const s = summarize(atImplement([...built('01'), { step: 'implement', name: 'tdd' }]), TICKETS)
    expect(s.tickets.done).toBe(1)
  })

  test('skip ticket passes the next ticket', () => {
    const s = summarize(atImplement([{ step: 'skip', name: 'skip' }]), TICKETS)
    expect(s.rows.filter(r => r.kind === 'ticket').map(r => r.kind === 'ticket' && r.status)).toEqual(['skipped', 'current', 'todo', 'todo'])
  })

  test('the progress bar fills ticket by ticket', () => {
    expect(summarize(atImplement(built('01', '02')), TICKETS).fraction).toBe((3 + 0.5) / 6)
  })

  test('finishing a ticket toasts the next one', () => {
    const { toast } = record(atImplement(), parseInvocation('implement', '')!, TICKETS, '01')
    expect(toast).toBe('Ticket 01 done. Next: 02 Cart API')
  })

  test('Quick ignores ticket files', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec') }), TICKETS)
    expect(s.next?.command).toBe('/implement')
  })
})

describe('resolveTicket', () => {
  const at = atImplement(built('01'))

  test('a bare /implement builds the next ticket', () => {
    expect(resolveTicket(parseInvocation('implement', '')!, at, TICKETS)).toBe('02')
  })

  test('a reference names its ticket by number, file name, path or issue number', () => {
    for (const args of ['04', '4', '04-receipt-email.md', '.scratch/checkout/issues/04-receipt-email.md', '#4']) {
      expect(resolveTicket(parseInvocation('implement', args)!, at, TICKETS)).toBe('04')
    }
  })

  test('implement-spec builds them all, and tdd builds none', () => {
    expect(resolveTicket(parseInvocation('implement-spec', '')!, at, TICKETS)).toBe('*')
    expect(resolveTicket(parseInvocation('tdd', '')!, at, TICKETS)).toBeUndefined()
  })

  test('without ticket files there is nothing to name', () => {
    expect(resolveTicket(parseInvocation('implement', '03')!, at, [])).toBeUndefined()
  })
})

describe('marking by hand', () => {
  const hand = (step: Run['step'], extra: Partial<Run> = {}): Run => ({ step, name: 'hand', by: 'hand', ...extra })

  test('marking a step marks every step before it, tickets included', () => {
    const s = summarize(atImplement([hand('review')]), TICKETS)
    expect(s.next?.step.id).toBe('retro')
    expect(s.rows.find(r => r.kind === 'step' && r.step === 'implement')).toMatchObject({ status: 'done', count: '4 of 4 done' })
  })

  test('unmarking a done step makes it current again', () => {
    const s = summarize(atImplement([hand('spec', { undo: true })]), TICKETS)
    expect(s.next?.step.id).toBe('spec')
  })

  test('marking the optional prototype touches nothing else', () => {
    const s = summarize(project({ runs: [hand('prototype')] }))
    expect(s.rows[1]).toMatchObject({ kind: 'optional', isDone: true })
    expect(s.next?.step.id).toBe('grill')
  })

  test('a ticket row toggles its ticket', () => {
    expect(summarize(atImplement([hand('implement', { ticket: '02' })]), TICKETS).tickets.done).toBe(1)
    expect(
      summarize(atImplement([hand('implement', { ticket: '02' }), hand('implement', { ticket: '02', undo: true })]), TICKETS).tickets
        .done,
    ).toBe(0)
  })

  test('without ticket files the count set by hand drives implement', () => {
    const at = project({ ticketCount: 3, runs: [...ran('grill-with-docs', 'to-spec', 'to-tickets'), ...ran('implement')] })
    const s = summarize(at)
    expect(s.next?.meta).toBe('Step 4 of 6')
    expect(s.next?.sub).toBe('Ticket 2 of 3')
    expect(s.rows.find(r => r.kind === 'step' && r.step === 'implement')).toMatchObject({ count: '1 of 3 done' })
    expect(summarize({ ...at, runs: [...at.runs, ...ran('implement', 'implement')] }).next?.step.id).toBe('review')
  })
})

describe('review', () => {
  test('a code review while tickets remain is part of implement', () => {
    const s = summarize(atImplement([...built('01'), ...ran('code-review')]), TICKETS)
    expect(s.next?.ticket?.id).toBe('02')
    expect(s.rows.find(r => r.kind === 'step' && r.step === 'review')).toMatchObject({ status: 'todo' })
  })

  test('the review /implement runs on the last ticket completes review', () => {
    const s = summarize(atImplement([...built('01', '02', '03', '04'), ...ran('code-review')]), TICKETS)
    expect(s.next?.step.id).toBe('retro')
  })

  test('in Quick a code review before implement does not count', () => {
    const s = summarize(project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec', 'code-review') }))
    expect(s.next?.step.id).toBe('implement')
  })

  test('the review command compares against the base', () => {
    const at = project({ flow: 'quick', base: 'develop', runs: ran('grill-with-docs', 'to-spec', 'implement') })
    expect(summarize(at).next?.command).toBe('/code-review develop')
    expect(summarize({ ...at, base: ' ' }).next?.command).toBe('/code-review main')
  })
})

describe('bug flow', () => {
  const diagnose = parseInvocation('diagnosing-bugs', 'checkout total is wrong')!

  test('diagnose, then retro, then an optional architecture follow-up', () => {
    const s = summarize(project({ flow: 'bug' }))
    expect(s.next?.command).toBe('/diagnosing-bugs')
    expect(s.next?.hint).toBe('No theories until one command goes red on this bug.')
    expect(s.rows.map(r => r.kind)).toEqual(['step', 'step', 'optional'])
    const after = summarize(project({ flow: 'bug', runs: ran('diagnosing-bugs') }))
    expect(after.next?.hint).toBe('Ask what would have prevented this bug, in this same session.')
  })

  test('a diagnosis with no flow picks the Bug flow', () => {
    const { project: after, toast } = record(project({ flow: null }), diagnose, [])
    expect(after.flow).toBe('bug')
    expect(toast).toBe('Diagnose done. Next: retro')
  })

  test('a diagnosis after a finished flow starts the Bug flow afresh', () => {
    const done = project({ flow: 'quick', runs: ran('grill-with-docs', 'to-spec', 'implement', 'code-review', 'retro') })
    const { project: after } = record(done, diagnose, [])
    expect(after.flow).toBe('bug')
    expect(after.runs).toHaveLength(1)
  })

  test('a diagnosis mid-build is a detour that keeps the flow where it is', () => {
    const { project: after, toast } = record(project({ runs: ran('grill-with-docs') }), diagnose, [])
    expect(after.flow).toBe('full')
    expect(toast).toBe('Diagnosed a bug. Back to: spec')
    const s = summarize(after)
    expect(s.next?.step.id).toBe('spec')
    expect(s.rows.findIndex(r => r.kind === 'detour')).toBe(s.rows.findIndex(r => r.kind === 'step' && r.step === 'spec') + 1)
  })
})

describe('catchUp', () => {
  const typedRow = (name: string, args = '') => ({
    role: 'user' as const,
    text: `<command-message>${name} is running…</command-message>\n<command-name>/${name}</command-name>\n<command-args>${args}</command-args>`,
    toolUses: [],
  })
  const skillRow = (skill: string, args = '') => ({
    role: 'assistant' as const,
    text: '',
    toolUses: [{ tool_use_id: 't1', tool: 'Skill', input: { skill, args } }],
  })

  test('picks up commands typed and skills invoked earlier in the session', () => {
    const { project: after, picked } = catchUp(project({ flow: null }), [], {
      messages: [typedRow('grill-with-docs'), skillRow('mattpocock-skills:to-spec'), { role: 'user', text: '/commit', toolUses: [] }],
      hasSpec: false,
    })
    expect(after.flow).toBe('full')
    expect(picked).toEqual(['Grill', 'Spec'])
    expect(summarize(after).next?.step.id).toBe('tickets')
  })

  test('reads a leading slash command in a plain message', () => {
    const { picked } = catchUp(project(), [], { messages: [{ role: 'user', text: '/grill-me the checkout', toolUses: [] }], hasSpec: false })
    expect(picked).toEqual(['Grill'])
  })

  test('the spec file, ticket files and resolved tickets mark progress', () => {
    const tickets = [ticket('01', 'Cart model', [], 'resolved'), ticket('02', 'Cart API', [1], 'done'), ticket('03', 'Pay button', [2])]
    const { project: after, picked } = catchUp(project({ runs: ran('grill-with-docs') }), tickets, { messages: [], hasSpec: true })
    expect(picked).toEqual(['Spec', 'Tickets', '2 tickets'])
    expect(summarize(after, tickets).next?.ticket?.id).toBe('03')
  })

  test('only adds: what the pane already has is left alone and not repeated', () => {
    const at = project({ runs: ran('grill-with-docs', 'to-spec') })
    const { project: after, picked } = catchUp(at, [], { messages: [typedRow('grill-with-docs'), typedRow('to-spec')], hasSpec: true })
    expect(picked).toEqual([])
    expect(after).toBe(at)
  })

  test('a bare /implement in the transcript never marks a ticket again', () => {
    const { picked } = catchUp(atImplement(built('01')), TICKETS, { messages: [typedRow('implement')], hasSpec: true })
    expect(picked).toEqual([])
  })

  test('an /implement naming its ticket marks that ticket', () => {
    const { picked } = catchUp(atImplement(), TICKETS, { messages: [typedRow('implement', '.scratch/checkout/issues/02-cart-api.md')], hasSpec: true })
    expect(picked).toEqual(['1 ticket'])
  })
})
