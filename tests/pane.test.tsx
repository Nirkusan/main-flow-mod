import { expect, test } from 'claude-code/testing'

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

const skillOk = () => ({ result: { success: true, commandName: 'skill' } })

test('with no flow the pane offers the first command', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    expect(await ui.find({ type: 'Text', text: /Builds that span sessions/ })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/grill-with-docs')
    await ui.unmount()
  }
})

test('choosing a flow shows the next command first', async $ => {
  for (const surface of ['terminal', 'desktop'] as const) {
    const ui = await $.ui.mount({ ...PANE, surface })
    await ui.select({ key: 'flow', value: 'quick' })
    expect(await ui.find({ type: 'Text', text: 'Step 1 of 5' })).toBeDefined()
    expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/grill-with-docs')
    await ui.press({ key: 'reset' })
    await ui.unmount()
  }
})

test('skip moves to the next step', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await ui.press({ key: 'skip' })
  expect(await ui.find({ type: 'Text', text: 'Step 2 of 6' })).toBeDefined()
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/to-spec')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('a Skill call advances the flow, picking Full when none is chosen', async ($, on) => {
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
  on('tool.call', () => ({ result: { success: false }, isError: true }))
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'full' })
  await $.tool.call({ tool: 'Skill', skill: 'grilling', args: '' })
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 6' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('finishing a flow offers Start again', async ($, on) => {
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

test('mobile picks the flow with buttons', async $ => {
  const ui = await $.ui.mount({ ...PANE, surface: 'mobile' })
  await ui.press({ key: 'flow-quick' })
  expect(await ui.find({ type: 'Text', text: 'Step 1 of 5' })).toBeDefined()
  await ui.press({ key: 'reset' })
  await ui.unmount()
})

test('/main-flow prints the flow where no pane is placed', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: false, reason: 'no surface' } }))
  const out = await $.command.run({ ...COMMAND, args: 'quick' })
  expect(out.text).toContain('Next: Grill (step 1 of 5)')
  expect(out.text).toContain('/grill-with-docs')
  await $.command.run({ ...COMMAND, args: 'reset' })
})

test('/main-flow says the pane opened where it is placed', async ($, on) => {
  on('ui.open', () => ({ value: { isPlaced: true } }))
  expect((await $.command.run({ ...COMMAND, args: '' })).text).toBe('Main flow pane opened.')
})

test('an alias from the settings counts as its step', { options: { aliases: 'grill=interview-me' } }, async ($, on) => {
  on('tool.call', skillOk)
  const ui = await $.ui.mount({ ...PANE, surface: 'desktop' })
  await ui.select({ key: 'flow', value: 'quick' })
  await $.tool.call({ tool: 'Skill', skill: 'my-plugin:interview-me', args: '' })
  expect((await ui.find({ type: 'Code' }))?.props.source).toBe('/to-spec')
  await ui.press({ key: 'reset' })
  await ui.unmount()
})
