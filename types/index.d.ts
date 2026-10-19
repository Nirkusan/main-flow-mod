export type FlowId = 'full' | 'quick' | 'bug'

export type StepId =
  | 'grill'
  | 'prototype'
  | 'spec'
  | 'tickets'
  | 'implement'
  | 'review'
  | 'retro'
  | 'diagnose'
  | 'architecture'

// One recorded use of a main-flow command, or a press in the pane.
export type Run = {
  step: StepId | 'skip'
  // The command's name as run, without a plugin prefix (`implement-spec`, `tdd`).
  name: string
  // The ticket an implement run built: its number, or `*` for all of them.
  ticket?: string
  by?: 'hand' | 'catch-up'
  undo?: true
}

// One ticket file of the feature: `.scratch/<feature>/issues/NN-slug.md`.
export type Ticket = {
  // The number the file name starts with, as written (`03`).
  id: string
  title: string
  path: string
  // The numbers of the tickets that must be done first.
  blockedBy: number[]
  // The file's `Status:` line (`ready-for-agent`, `resolved`), or '' without one.
  status: string
}

export type Project = {
  flow: FlowId | null
  runs: Run[]
  feature: string
  base: string
  // How many tickets there are when no ticket files exist.
  ticketCount: number
}

declare module 'claude-code' {
  interface PluginState {
    'main-flow': { project: Project; tickets: Ticket[]; pendingFeature: string | null }
  }
}
