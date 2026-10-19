import { expect, mock, test } from 'claude-code/testing'
import type { On } from 'claude-code'

const PANE = {
  plugin: 'main-flow',
  component: 'Pane',
  requestId: 'main-flow',
  props: {
    title: 'Main flow',
    isFocused: false,
    bodyColumns: 34,
    placement: 'dock',
    scroll: { offset: 0, bodyRows: 40 },
    view: {},
  },
} as const

const COMMAND = { command: 'main-flow', origin: { kind: 'composer' }, presentation: { isFullscreen: false, columns: 80 } } as const

// The project folder and the plugin's store, which every hook that saves progress reads.
const world = (on: On, cwd = '/work/shop') => {
  mock.store(on)
  on('session.cwd', () => ({ value: cwd }))
}

// A session starting in `cwd`, as the engine raises it after a launch, a resume or a new window.
const sessions = (on: On) => {
  let cwd = '/work/shop'
  mock.store(on)
  on('session.cwd', () => ({ value: cwd }))
  on('command.register', (_$, e) => ({ value: { command: e.name } }))
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('session.start', (_$, e) => ({ cwd: e.cwd }))

  return (folder: string) => {
    cwd = folder

    return { cwd: folder, surface: 'desktop', isInteractive: true } as const
  }
}

// A project's files, answered as `$.fs` would from the folder `cwd`.
const files = (on: On, tree: Record<string, string>, cwd = '/work/shop') => {
  const rel = (path: string) => path.replace(`${cwd}/`, '').replace(/^\.\//, '').replace(/\/$/, '')
  on('fs.read', (_$, e) => (rel(e.path) in tree ? { value: tree[rel(e.path)]! } : { deny: `${e.path}: missing` }))
  on('fs.list', (_$, e) => {
    const dir = rel(e.path)
    const names = new Map<string, 'file' | 'dir'>()

    for (const path of Object.keys(tree)) {
      if (path.startsWith(`${dir}/`)) {
        const [name = '', ...rest] = path.slice(dir.length + 1).split('/')
        names.set(name, rest.length > 0 ? 'dir' : 'file')
      }
    }

    return names.size > 0
      ? { value: [...names].map(([name, kind]) => ({ name, kind, size: 1, mtimeMs: 0, isLink: false })) }
      : { deny: `${e.path}: missing` }
  })
}

const ticketFile = (id: string, title: string, blockedBy = 'None (can start immediately)') =>
  `# ${id}: ${title}\n\n**What to build:** ...\n\n**Blocked by:** ${blockedBy}\n\n**Status:** ready-for-agent\n`

const CHECKOUT = {
  '.scratch/checkout/spec.md': '# Spec',
  '.scratch/checkout/issues/01-cart-model.md': ticketFile('01', 'Cart model'),
  '.scratch/checkout/issues/02-cart-api.md': ticketFile('02', 'Cart API', '01'),
  '.scratch/checkout/issues/03-pay-button.md': ticketFile('03', 'Pay button', '02'),
}

const skillOk = () => ({ result: { success: true, commandName: 'skill' } })

test('with no flow the pane offers the first command', async ($, on) => {
  world(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Builds that span sessions/ })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/grill-with-docs')
    await ui.unmount()
  }
})

test('choosing a flow shows the next command first', async ($, on) => {
  world(on)
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.select({ key: 'flow', value: 'quick' })
    expect(await ui.find({ type: 'Text', text: 'Step 1 of 5' })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/grill-with-docs')
    await ui.press({ key: 'reset' })
    await ui.unmount()
  }
})

test('skip moves to the next step', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await ui.press({ key: 'skip' })
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 6' })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/to-spec')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('a Skill call advances the flow, picking Full when none is chosen', async ($, on) => {
  world(on)
  on('tool.call', skillOk)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await $.tool.call({ tool: 'Skill', skill: 'grilling', args: '' })
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 6' })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/to-spec')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

// The engine sets `command` on a typed slash command; a test passes it through.
const typed = (name: string, args = '') =>
  ({ text: `/${name} ${args}`.trim(), command: { name, args } }) as never

test('typing a slash command advances the flow', async ($, on) => {
  world(on)
  on('prompt.submit', (_$, e) => ({ text: e.text }))
  const ui = await $.ui.mount({ ...PANE, surface: 'terminal' })
  await ui.select({ key: 'flow', value: 'quick' })
  await $.prompt.submit(typed('grill-with-docs'))
  await $.prompt.submit(typed('mattpocock-skills:to-spec'))
  expect(await ui.find({ type: 'Text', text: 'Step 3 of 5' })).toBeDefined()
  await $.prompt.submit(typed('commit', 'all'))
  expect(await ui.find({ type: 'Text', text: 'Step 3 of 5' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('a failed Skill call does not count', async ($, on) => {
  world(on)
  on('tool.call', () => ({ result: { success: false }, isError: true }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await $.tool.call({ tool: 'Skill', skill: 'grilling', args: '' })
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 6' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('finishing a flow offers Start again', async ($, on) => {
  world(on)
  on('tool.call', skillOk)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  for (const skill of ['grilling', 'to-spec', 'implement', 'code-review', 'retro']) {
    await $.tool.call({ tool: 'Skill', skill, args: '' })
  }
  expect(await ui.find({ type: 'Text', text: 'Flow complete' })).toBeDefined()
  await ui.press({ key: 'start-again' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/grill-with-docs')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('mobile picks the flow with buttons', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'flow-quick' })
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 5' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('/main-flow prints the flow where no pane is placed', async ($, on) => {
  world(on)
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface' } }))
  const out = await $.command.run({ ...COMMAND, args: 'quick' })
  expect(out.text).toContain('Next: Grill (step 1 of 5)')
  expect(out.text).toContain('/grill-with-docs')
  await $.command.run({ ...COMMAND, args: 'reset' })
})

test('/main-flow says the pane opened where it is placed', async ($, on) => {
  world(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  expect((await $.command.run({ ...COMMAND, args: '' })).text).toBe('Main flow pane opened.')
})

test('an alias from the settings counts as its step', { options: { aliases: 'grill=interview-me' } }, async ($, on) => {
  world(on)
  on('tool.call', skillOk)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  await $.tool.call({ tool: 'Skill', skill: 'my-plugin:interview-me', args: '' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/to-spec')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('progress is kept per project across sessions', async ($, on) => {
  on('tool.call', skillOk)
  const startIn = sessions(on)
  await $.session.start(startIn('/work/shop'))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  await $.tool.call({ tool: 'Skill', skill: 'grilling', args: '' })

  await $.session.start(startIn('/work/blog'))
  expect(await ui.find({ type: 'Text', text: /Builds that span sessions/ })).toBeDefined()

  await $.session.start(startIn('/work/shop'))
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 5' })).toBeDefined()

  await ui.press({ key: 'reset' })
  await $.session.start(startIn('/work/shop'))
  expect(await ui.find({ type: 'Text', text: /Builds that span sessions/ })).toBeDefined()
  await ui.unmount()
})

test('a Full build tracks the tickets in the feature folder', async ($, on) => {
  on('tool.call', skillOk)
  const startIn = sessions(on)
  files(on, CHECKOUT)
  await $.session.start(startIn('/work/shop'))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })

  for (const skill of ['grilling', 'to-spec', 'to-tickets']) {
    await $.tool.call({ tool: 'Skill', skill, args: '' })
  }
  expect((await ui.find({ key: 'feature' }))?.props.value).toBe('checkout')
  expect(await ui.find({ type: 'Text', text: '01 Cart model' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: 'Implement · ticket 1 of 3' })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/implement .scratch/checkout/issues/01-cart-model.md')

  await $.tool.call({ tool: 'Skill', skill: 'implement', args: '01' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/implement .scratch/checkout/issues/02-cart-api.md')
  expect(await ui.find({ type: 'Text', text: '1 of 3 done' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('a new feature asks before clearing progress', async ($, on) => {
  on('tool.call', skillOk)
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await ui.input({ key: 'feature', text: 'checkout' })
  await $.tool.call({ tool: 'Skill', skill: 'grilling', args: '' })

  await ui.input({ key: 'feature', text: 'search' })
  expect(await ui.find({ type: 'Text', text: 'New feature clears progress.' })).toBeDefined()
  await ui.press({ key: 'feature-keep' })
  expect((await ui.find({ key: 'feature' }))?.props.value).toBe('search')
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 6' })).toBeDefined()

  await ui.input({ key: 'feature', text: 'billing' })
  await ui.press({ key: 'feature-clear' })
  expect((await ui.find({ key: 'feature' }))?.props.value).toBe('billing')
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 6' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('mobile shows the feature as text', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'flow-full' })
  expect(await ui.find({ type: 'Text', text: 'Feature: none yet' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('tapping a step marks it and the steps before it; tapping again undoes it', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  await ui.press({ key: 'step-implement' })
  expect(await ui.find({ type: 'Text', text: 'Step 4 of 5' })).toBeDefined()
  await ui.press({ key: 'step-implement' })
  expect(await ui.find({ type: 'Text', text: 'Step 3 of 5' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('tapping a ticket row toggles it', async ($, on) => {
  on('tool.call', skillOk)
  const startIn = sessions(on)
  files(on, CHECKOUT)
  await $.session.start(startIn('/work/shop'))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await ui.press({ key: 'step-tickets' })
  await ui.press({ key: 'ticket-01' })
  expect(await ui.find({ type: 'Text', text: '02 Cart API' })).toBeDefined()
  await ui.press({ key: 'ticket-01' })
  expect(await ui.find({ type: 'Text', text: '01 Cart model' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('without ticket files the person sets the ticket count', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await ui.press({ key: 'step-tickets' })
  await ui.input({ key: 'ticket-count', text: '3' })
  expect(await ui.find({ type: 'Text', text: 'Ticket 1 of 3' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('the Base field shows only when review is next and fills its command', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  expect(await ui.find({ key: 'base' })).toBeUndefined()
  await ui.press({ key: 'step-implement' })
  expect((await ui.find({ key: 'base' }))?.props.value).toBe('main')
  await ui.input({ key: 'base', text: 'develop' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/code-review develop')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('mobile shows the base as text', async ($, on) => {
  world(on)
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'flow-quick' })
  await ui.press({ key: 'step-implement' })
  expect(await ui.find({ type: 'Text', text: 'Base: main' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})
