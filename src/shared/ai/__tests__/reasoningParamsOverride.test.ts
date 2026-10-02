import { describe, expect, it } from 'vitest'

import {
  collectReasoningParamLeafPaths,
  ReasoningParamsOverrideSchema,
  type RuntimeReasoning
} from '@shared/data/types/model'

import { findReasoningParamsConflicts, reasoningTargetBodyPaths } from '../reasoning'

const genericEffortWire = {
  off: { operations: [{ target: 'reasoningEffort' as const, value: { source: 'literal' as const, value: 'none' } }] },
  auto: { operations: [{ target: 'reasoningEffort' as const, value: { source: 'effort' as const } }] },
  effort: { operations: [{ target: 'reasoningEffort' as const, value: { source: 'effort' as const } }] }
}

const reasoning: RuntimeReasoning = {
  selectableEfforts: ['low', 'medium', 'high'],
  defaultEffort: 'low'
}

describe('ReasoningParamsOverrideSchema', () => {
  it('accepts type-preserving values on reviewed reasoning wire leaves', () => {
    const parsed = ReasoningParamsOverrideSchema.parse({ reasoning: { effort: 42 } })
    expect(parsed).toEqual({ reasoning: { effort: 42 } })
    expect(typeof (parsed as any).reasoning.effort).toBe('number')
  })

  it('rejects fields outside the reviewed reasoning wire set', () => {
    expect(ReasoningParamsOverrideSchema.safeParse({ api_key: 'x' }).success).toBe(false)
    expect(ReasoningParamsOverrideSchema.safeParse({ reasoning: { effort: 42 }, headers: { a: 'b' } }).success).toBe(
      false
    )
    expect(ReasoningParamsOverrideSchema.safeParse({ thinking_budget_extra: 1 }).success).toBe(false)
  })

  it('rejects non-finite numbers and scalar-unsafe shapes', () => {
    expect(ReasoningParamsOverrideSchema.safeParse({ reasoning: { max_tokens: Number.NaN } }).success).toBe(false)
    expect(ReasoningParamsOverrideSchema.safeParse({ reasoning_effort: Number.POSITIVE_INFINITY }).success).toBe(false)
    expect(ReasoningParamsOverrideSchema.safeParse({ think: [1] }).success).toBe(false)
  })

  it('collects dotted leaf paths through nested objects', () => {
    expect(collectReasoningParamLeafPaths({ reasoning: { effort: 42 }, think: false })).toEqual([
      { path: 'reasoning.effort', value: 42 },
      { path: 'think', value: false }
    ])
  })
})

describe('reasoningTargetBodyPaths', () => {
  it('maps the effort knob to the endpoint body field', () => {
    expect(reasoningTargetBodyPaths('reasoningEffort', 'openai-responses')).toEqual(['reasoning.effort'])
    expect(reasoningTargetBodyPaths('reasoningEffort', 'openai-chat-completions')).toEqual(['reasoning_effort'])
  })

  it('keeps vendor wire targets as their own body paths', () => {
    expect(reasoningTargetBodyPaths('thinking.type', 'anthropic-messages' as any)).toEqual(['thinking.type'])
  })
})

describe('findReasoningParamsConflicts', () => {
  it('reports params that collide with reachable standard control fields', () => {
    expect(
      findReasoningParamsConflicts(
        { reasoning: { effort: 42 } },
        { reasoning, wire: genericEffortWire, endpointType: 'openai-responses' }
      )
    ).toEqual(['reasoning.effort'])
    expect(
      findReasoningParamsConflicts(
        { reasoning_effort: 42 },
        { reasoning, wire: genericEffortWire, endpointType: 'openai-chat-completions' }
      )
    ).toEqual(['reasoning_effort'])
  })

  it('allows params on fields the standard controls can never write', () => {
    expect(
      findReasoningParamsConflicts(
        { reasoning: { exclude: true } },
        { reasoning, wire: genericEffortWire, endpointType: 'openai-responses' }
      )
    ).toEqual([])
  })

  it('allows everything when the model declares no reasoning (no standard writer exists)', () => {
    expect(
      findReasoningParamsConflicts(
        { reasoning: { effort: 42 } },
        { reasoning: undefined, wire: genericEffortWire, endpointType: 'openai-responses' }
      )
    ).toEqual([])
  })

  it('treats the off mode as reachable only when none is selectable', () => {
    const toggleWire = {
      off: {
        operations: [{ target: 'disable_reasoning' as const, value: { source: 'literal' as const, value: true } }]
      },
      effort: { operations: [{ target: 'reasoningEffort' as const, value: { source: 'effort' as const } }] }
    }
    expect(
      findReasoningParamsConflicts(
        { disable_reasoning: false },
        { reasoning: { selectableEfforts: ['low'] }, wire: toggleWire, endpointType: 'openai-responses' }
      )
    ).toEqual([])
    expect(
      findReasoningParamsConflicts(
        { disable_reasoning: false },
        { reasoning: { selectableEfforts: ['none', 'low'] }, wire: toggleWire, endpointType: 'openai-responses' }
      )
    ).toEqual(['disable_reasoning'])
  })
})
