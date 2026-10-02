import { describe, expect, it } from 'vitest'

import { UserReasoningEffortOverrideSchema, type RuntimeReasoning } from '@shared/data/types/model'

import { applyReasoningEffortOverride } from '../reasoning'

describe('UserReasoningEffortOverrideSchema', () => {
  it('accepts a valid custom vocabulary', () => {
    const parsed = UserReasoningEffortOverrideSchema.parse({ choices: ['none', 'low'], defaultChoice: 'none' })
    expect(parsed.choices).toEqual(['none', 'low'])
  })

  it('rejects an empty choices list', () => {
    expect(UserReasoningEffortOverrideSchema.safeParse({ choices: [] }).success).toBe(false)
  })

  it('rejects duplicate choices', () => {
    expect(UserReasoningEffortOverrideSchema.safeParse({ choices: ['low', 'low'] }).success).toBe(false)
  })

  it('rejects effort values outside the closed vocabulary', () => {
    expect(UserReasoningEffortOverrideSchema.safeParse({ choices: ['turbo'] }).success).toBe(false)
  })

  it('rejects a defaultChoice missing from choices', () => {
    expect(UserReasoningEffortOverrideSchema.safeParse({ choices: ['low'], defaultChoice: 'high' }).success).toBe(false)
  })
})

describe('applyReasoningEffortOverride', () => {
  const reasoning: RuntimeReasoning = {
    controls: [{ kind: 'effort', values: ['low', 'medium', 'high'], default: 'low' }],
    selectableEfforts: ['low', 'medium', 'high'],
    defaultEffort: 'low'
  }

  it('replaces the catalog vocabulary with the user one, keeping the other descriptor fields', () => {
    const result = applyReasoningEffortOverride(reasoning, { choices: ['none', 'low'] })
    expect(result?.selectableEfforts).toEqual(['none', 'low'])
    expect(result?.controls).toEqual(reasoning.controls)
    expect(result?.defaultEffort).toBe('low')
  })

  it('keeps the catalog vocabulary when no override is stored', () => {
    expect(applyReasoningEffortOverride(reasoning, null)).toBe(reasoning)
    expect(applyReasoningEffortOverride(reasoning, undefined)).toBe(reasoning)
  })

  it('never invents reasoning for a model that declares none', () => {
    expect(applyReasoningEffortOverride(undefined, { choices: ['none'] })).toBeUndefined()
  })

  it('does not mutate the projected reasoning', () => {
    const result = applyReasoningEffortOverride(reasoning, { choices: ['none'] })
    result?.selectableEfforts?.push('ultra')
    expect(reasoning.selectableEfforts).toEqual(['low', 'medium', 'high'])
  })
})
