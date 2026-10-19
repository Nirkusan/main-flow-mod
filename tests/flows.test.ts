import { describe, expect, test } from 'claude-code/testing'

import type { Project, Run } from '../types'
import { describeFlow, parseInvocation, record, summarize } from '../hooks/flows'

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
