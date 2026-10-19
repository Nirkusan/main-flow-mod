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
    'main-flow': { project: Project }
  }
}
