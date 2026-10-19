import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register, RenderSurface } from 'claude-code'

import type { Project, Run, StepId, Ticket } from '../types'
import {
  DEFAULT_BASE,
  FLOWS,
  MARKS,
  aliasTable,
  catchUp,
  commandFor,
  describeFlow,
  isFlowId,
  parseInvocation,
  parseTicket,
  record,
  resolveTicket,
  summarize,
} from './flows'
import type { Message, Row, Summary } from './flows'

const PANE = 'main-flow'
const TITLE = 'Main flow'

const EMPTY: Project = { flow: null, runs: [], feature: '', base: DEFAULT_BASE, ticketCount: 0 }

const PROJECT = { plugin: 'main-flow', key: 'project' } as const
const project = atom(PROJECT, EMPTY)

// Progress belongs to the project folder and outlives the session, so it is kept in the store too.
const storeKey = (cwd: string) => `project:${cwd}`

const isProject = (value: unknown): value is Project =>
  typeof value === 'object' && value !== null && Array.isArray((value as Project).runs)

const saved = async ($: EngineInterface, cwd: string): Promise<Project> => {
  const value = await $.store.get(storeKey(cwd))

  return isProject(value) ? { ...EMPTY, ...value } : EMPTY
}

const change = async ($: EngineInterface, fn: (p: Project) => Project) => {
  const cwd = await $.session.cwd()

  // After a /clear the session's values start over while the store still holds the project.
  if ((await $.state.get(PROJECT)).version === 0) {
    await $.state.set(PROJECT, await saved($, cwd))
  }

  await update($, project, p => fn(p ?? EMPTY))
  await $.store.set(storeKey(cwd), await read($, project))
}

const loadProject = async ($: EngineInterface) => {
  const held = await $.state.get(PROJECT)

  return held.version === 0 ? saved($, await $.session.cwd()) : (held.value ?? EMPTY)
}

const TICKETS = { plugin: 'main-flow', key: 'tickets' } as const
const PENDING = { plugin: 'main-flow', key: 'pendingFeature' } as const
const pendingFeature = atom(PENDING, null)

const listDir = async ($: EngineInterface, path: string) => {
  try {
    return await $.fs.list(path)
  } catch {
    return []
  }
}

// `dir` is relative to the project folder, so the ticket's path reads as the person would type it.
const readTicket = async ($: EngineInterface, cwd: string, dir: string, file: string): Promise<Ticket | undefined> => {
  try {
    return parseTicket(dir, file, String(await $.fs.read(`${cwd}/${dir}/${file}`)))
  } catch {
    return undefined
  }
}

const readTickets = async ($: EngineInterface, feature: string) => {
  if (feature === '') {
    return []
  }

  const cwd = await $.session.cwd()
  const dir = `.scratch/${feature}/issues`
  const files = (await listDir($, `${cwd}/${dir}`)).filter(e => e.kind === 'file')
  const found = (await Promise.all(files.map(e => readTicket($, cwd, dir, e.name)))).filter(t => t !== undefined)

  return found.sort((a, b) => Number(a.id) - Number(b.id))
}

// The one folder in `.scratch` holding a spec or tickets, or '' when there are none or several.
const onlyFeature = async ($: EngineInterface) => {
  const root = `${await $.session.cwd()}/.scratch`
  const features: string[] = []

  for (const entry of await listDir($, root)) {
    const inside = entry.kind === 'dir' ? await listDir($, `${root}/${entry.name}`) : []

    if (inside.some(f => (f.name === 'issues' && f.kind === 'dir') || f.name === 'spec.md')) {
      features.push(entry.name)
    }
  }

  return features.length === 1 ? features[0]! : ''
}

// Reads the feature's ticket files, filling Feature in first when it is empty; says whether it filled it.
const scan = async ($: EngineInterface) => {
  let { feature } = await loadProject($)
  const isFilled = feature === '' && (feature = await onlyFeature($)) !== ''

  if (isFilled) {
    await change($, p => ({ ...p, feature }))
  }

  await $.state.set(TICKETS, await readTickets($, feature))

  return isFilled
}

// The tickets as last scanned; after a /clear, when the session's values start over, read from the files again.
const knownTickets = async ($: EngineInterface) => {
  const held = await $.state.get(TICKETS)

  return held.version === 0 ? readTickets($, (await loadProject($)).feature) : (held.value ?? [])
}

// Adds progress made before the pane was watching: earlier in this transcript, or in the feature's files.
// A new feature takes nothing from the transcript, which is about the old one.
const pickUp = async ($: EngineInterface, aliases: Readonly<Record<string, StepId>>, from: 'session' | 'files') => {
  const p = await loadProject($)
  let messages: Message[] = []
  let hasSpec = false

  try {
    messages = from === 'session' ? ((await $.session.messages()) as Message[]) : []
  } catch {}

  try {
    hasSpec = p.feature !== '' && (await $.fs.exists(`${await $.session.cwd()}/.scratch/${p.feature}/spec.md`))
  } catch {}

  const { project: caught, picked } = catchUp(p, await knownTickets($), { messages, hasSpec }, aliases)

  if (picked.length > 0) {
    await change($, () => caught)
    $.ui.toast(`Picked up: ${picked.join(', ')}`)
  }
}

const setFeature = async (
  $: EngineInterface,
  aliases: Readonly<Record<string, StepId>>,
  value: string,
  keepProgress?: boolean,
) => {
  const feature = value.trim()
  const p = await loadProject($)

  if (feature === p.feature) {
    return
  }

  if (keepProgress === undefined && p.runs.length > 0) {
    await $.state.set(PENDING, feature)

    return
  }

  await $.state.set(PENDING, null)
  await change($, q => ({ ...q, feature, runs: keepProgress ? q.runs : [] }))
  await scan($)
  await pickUp($, aliases, 'files')
}

const run = async ($: EngineInterface, aliases: Readonly<Record<string, StepId>>, command: string, args: string) => {
  const invocation = parseInvocation(command, args, aliases)

  if (invocation === undefined) {
    return
  }

  const known = await knownTickets($)
  let toast: string | undefined
  await change($, p => {
    const result = record(p, invocation, known, resolveTicket(invocation, p, known))
    toast = result.toast

    return result.project
  })

  if (toast) {
    $.ui.toast(toast)
  }
}

const copy = async ($: EngineInterface, text: string, surface: RenderSurface) => {
  const copied = await $.ui.copy({ text, surface })
  $.ui.toast(copied.isCopied ? 'Command copied' : 'Copy failed, select the command above')
}

const BAR_WIDTH = 228

const progressBar = (s: Summary) => {
  const filled = Math.round(BAR_WIDTH * s.fraction)

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${BAR_WIDTH}" height="4" viewBox="0 0 ${BAR_WIDTH} 4"><rect width="${BAR_WIDTH}" height="4" rx="2" fill="#8080804d"/><rect width="${filled}" height="4" rx="2" fill="#d97757"/></svg>`
}

const textBar = (s: Summary, columns: number) => {
  const width = Math.max(8, Math.min(30, columns - 2))
  const filled = Math.round(width * s.fraction)

  return '━'.repeat(filled) + '─'.repeat(width - filled)
}

export const register: Register = (on, options) => {
  const aliases = aliasTable(typeof options.aliases === 'string' ? options.aliases : '')

  on('session.start', async ($, e, next) => {
    await $.state.set(PROJECT, await saved($, e.cwd))
    await scan($)
    await pickUp($, aliases, 'session')
    await $.command.register({
      name: 'main-flow',
      description: 'Show the main flow and the next command',
      argumentHint: '[full|quick|bug|reset]',
    })
    void $.ui.open({ id: PANE, title: TITLE })

    return next(e)
  })

  on('command.run', { command: 'main-flow' }, async ($, e) => {
    const arg = e.args.trim().toLowerCase()

    if (arg === 'reset') {
      await change($, () => EMPTY)
    } else if (isFlowId(arg)) {
      await change($, p => ({ ...p, flow: arg }))
    } else if (arg !== '') {
      return { text: `Unknown flow "${arg}". Use ${FLOWS.map(f => f.id).join(', ')} or reset.` }
    }

    const opened = await $.ui.open({ id: PANE, title: TITLE })

    return { text: opened.isPlaced ? 'Main flow pane opened.' : describeFlow(await loadProject($), await knownTickets($)) }
  })

  // The person typing a slash command.
  on('prompt.submit', async ($, e, next) => {
    if (e.command !== undefined) {
      await run($, aliases, e.command.name, e.command.args)
    }

    return next(e)
  }).catch(($, e, next) => next(e))

  // Ticket files appear and change while Claude works, so read them again after each turn.
  on('turn.complete', async ($, e, next) => {
    const done = await next(e)

    if (await scan($)) {
      await pickUp($, aliases, 'files')
    }

    return done
  }).catch(($, e, next) => next(e))

  // Claude invoking a skill itself.
  on('tool.call', { tool: 'Skill' }, async ($, e, next) => {
    const ran = await next(e)

    if (ran.deny === undefined && ran.isError !== true) {
      await run($, aliases, e.skill, e.args ?? '')
    }

    return ran
  }).catch(($, e, next) => next(e))

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const els = $.ui.resolve(e)
    const { Box, Button, Code, Text } = els
    // The mobile app draws no Input or Select, the terminal no Svg; `in els` only narrows the table's type.
    const Input = e.surface !== 'mobile' && 'Input' in els ? els.Input : undefined
    const Select = e.surface !== 'mobile' && 'Select' in els ? els.Select : undefined
    const Svg = e.surface !== 'terminal' && 'Svg' in els ? els.Svg : undefined
    const p = await loadProject($)
    const known = await knownTickets($)
    const pending = await read($, pendingFeature)

    const header = (
      <Box flexDirection="row" gap={1} alignItems="center">
        {Select ? (
          <Box flexGrow={1}>
            <Select
              key="flow"
              label="Flow"
              value={p.flow ?? undefined}
              options={FLOWS.map(f => ({ value: f.id, label: f.label }))}
              onSelect={(value: string) => (isFlowId(value) ? change($, q => ({ ...q, flow: value })) : undefined)}
            />
          </Box>
        ) : (
          <Box flexGrow={1} flexDirection="row" flexWrap="wrap" gap={1}>
            {FLOWS.map(f => (
              <Button
                key={`flow-${f.id}`}
                label={f.label}
                variant={f.id === p.flow ? 'primary' : 'secondary'}
                onPress={() => change($, q => ({ ...q, flow: f.id }))}
              />
            ))}
          </Box>
        )}
        <Button key="reset" label="Reset" dimColor onPress={() => change($, () => EMPTY)} />
      </Box>
    )

    if (p.flow === null) {
      return (
        <Box flexDirection="column" gap={1}>
          {header}
          {FLOWS.map(f => (
            <Box key={`about-${f.id}`} flexDirection="column">
              <Text weight="semibold">{f.label}</Text>
              <Text dimColor>{f.summary}</Text>
            </Box>
          ))}
          <Box key="start" flexDirection="column" gap={1}>
            <Box flexDirection="row" justifyContent="space-between">
              <Text weight="bold" size="heading">
                Grill
              </Text>
              <Text dimColor size="footnote">
                Start here
              </Text>
            </Box>
            <Code source={commandFor('grill', p)} language="text" wrap="wrap" />
            <Text dimColor>Get interviewed about the plan. Running it picks Full; switch any time.</Text>
            <Button
              key="copy"
              label="Copy command"
              variant="primary"
              onPress={press => copy($, commandFor('grill', p), press.surface)}
            />
          </Box>
        </Box>
      )
    }

    const s = summarize(p, known)

    const featureField =
      p.flow === 'bug' ? undefined : Input ? (
        <Input
          key="feature"
          label="Feature"
          placeholder="Feature slug, e.g. checkout"
          submitLabel="set"
          value={p.feature}
          onSubmit={(value: string) => setFeature($, aliases, value)}
        />
      ) : (
        <Text dimColor>{`Feature: ${p.feature === '' ? 'none yet' : p.feature}`}</Text>
      )

    const confirm =
      pending === null ? undefined : (
        <Box key="confirm" flexDirection="row" justifyContent="space-between" alignItems="center" gap={1}>
          <Text dimColor size="footnote">
            New feature clears progress.
          </Text>
          <Box flexDirection="row" gap={1}>
            <Button key="feature-clear" label="Clear" onPress={() => setFeature($, aliases, pending, false)} />
            <Button key="feature-keep" label="Keep" onPress={() => setFeature($, aliases, pending, true)} />
          </Box>
        </Box>
      )

    const next = s.next ? (
      <Box key="next" flexDirection="column" gap={1}>
        <Box flexDirection="row" justifyContent="space-between">
          <Text weight="bold" size="heading">
            {s.next.heading}
          </Text>
          {s.next.meta ? (
            <Text dimColor size="footnote">
              {s.next.meta}
            </Text>
          ) : undefined}
        </Box>
        {s.next.sub ? (
          <Text dimColor size="footnote">
            {s.next.sub}
          </Text>
        ) : undefined}
        {s.next.step.id === 'review' ? (
          Input ? (
            <Input
              key="base"
              label="Base"
              placeholder="Branch or commit to compare against"
              submitLabel="set"
              value={p.base}
              onSubmit={(value: string) => change($, q => ({ ...q, base: value.trim() || DEFAULT_BASE }))}
            />
          ) : (
            <Text dimColor>{`Base: ${p.base}`}</Text>
          )
        ) : undefined}
        {s.next.step.id === 'implement' && p.flow === 'full' && known.length === 0 ? (
          Input ? (
            <Input
              key="ticket-count"
              label="Tickets"
              placeholder="How many tickets"
              submitLabel="set"
              value={p.ticketCount > 0 ? String(p.ticketCount) : ''}
              onSubmit={(value: string) => change($, q => ({ ...q, ticketCount: Math.max(0, Math.floor(Number(value)) || 0) }))}
            />
          ) : (
            <Text dimColor>{`Tickets: ${p.ticketCount > 0 ? p.ticketCount : 'not set'}`}</Text>
          )
        ) : undefined}
        <Code source={s.next.command} language="text" wrap="wrap" />
        <Text dimColor>{s.next.hint}</Text>
        <Button
          key="copy"
          label="Copy command"
          variant="primary"
          onPress={press => copy($, s.next!.command, press.surface)}
        />
        <Button
          key="skip"
          label={s.next.skipLabel}
          dimColor
          onPress={() => change($, q => ({ ...q, runs: [...q.runs, { step: 'skip', name: 'skip' }] }))}
        />
      </Box>
    ) : (
      <Box key="next" flexDirection="column" gap={1}>
        <Text weight="bold" size="heading">
          Flow complete
        </Text>
        <Text dimColor>
          {p.flow === 'bug' ? 'Fixed, and the lesson captured.' : 'Shipped. Start again for the next feature.'}
        </Text>
        <Button
          key="start-again"
          label="Start again"
          variant="primary"
          onPress={() => change($, q => ({ ...q, runs: [] }))}
        />
      </Box>
    )

    // What a screen reader says for a row, in place of its mark.
    const STATUS_WORDS = { done: 'done', current: 'next', skipped: 'skipped', todo: 'to do' } as const

    const mark = (extra: Partial<Run> & Pick<Run, 'step'>) =>
      change($, q => ({ ...q, runs: [...q.runs, { name: 'hand', by: 'hand', ...extra }] }))

    const row = (r: Row, i: number) => {
      switch (r.kind) {
        case 'step':
          return (
            <Box key={`row-${i}`} flexDirection="row" justifyContent="space-between">
              <Button
                key={`step-${r.step}`}
                label={`${r.label}, ${STATUS_WORDS[r.status]}`}
                plain
                onPress={() => mark({ step: r.step, ...(r.status === 'done' && { undo: true }) })}
              >
                <Text
                  weight={r.status === 'current' ? 'semibold' : 'regular'}
                  color={r.status === 'current' ? 'claude' : undefined}
                  dimColor={r.status === 'done' || r.status === 'skipped'}
                  strikethrough={r.status === 'skipped'}
                >
                  {`${MARKS[r.status]}  ${r.label}`}
                </Text>
              </Button>
              {r.count ? (
                <Text dimColor size="footnote">
                  {r.count}
                </Text>
              ) : undefined}
            </Box>
          )
        case 'optional':
          return (
            <Button
              key={`step-${r.step}`}
              label={`Optional ${r.label}, ${r.isDone ? 'done' : 'not run'}`}
              plain
              onPress={() => mark({ step: r.step, ...(r.isDone && { undo: true }) })}
            >
              <Text dimColor size="footnote">
                {`   +  Optional: ${r.isDone ? '✓ ' : ''}${r.label}`}
              </Text>
            </Button>
          )
        case 'ticket':
          return (
            <Button
              key={`ticket-${r.id}`}
              label={`Ticket ${r.id} ${r.title}, ${STATUS_WORDS[r.status]}`}
              plain
              onPress={() => mark({ step: 'implement', ticket: r.id, ...(r.status === 'done' && { undo: true }) })}
            >
              <Text
                size="footnote"
                weight={r.status === 'current' ? 'semibold' : 'regular'}
                dimColor={r.status === 'done' || r.status === 'skipped'}
              >
                {`   ${MARKS[r.status]}  ${r.id} ${r.title}`}
              </Text>
            </Button>
          )
        case 'detour':
          return (
            <Text key={`row-${i}`} dimColor size="footnote">
              {`   ↳  ${r.label}`}
            </Text>
          )
      }
    }

    return (
      <Box flexDirection="column" gap={1}>
        {header}
        {featureField}
        {confirm}
        {next}
        {Svg ? (
          <Svg
            source={progressBar(s)}
            alt={`${s.requiredDone} of ${s.requiredTotal} steps done`}
            width={BAR_WIDTH}
            height={4}
          />
        ) : (
          <Text dimColor>{textBar(s, e.props.bodyColumns)}</Text>
        )}
        <Box key="steps" flexDirection="column">
          {s.rows.map(row)}
        </Box>
      </Box>
    )
  })
}
