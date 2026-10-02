import { createOpenAI } from '@ai-sdk/openai'
import type { LanguageModelV3CallOptions } from '@ai-sdk/provider'
import { describe, expect, it } from 'vitest'

import type { ResolvedReasoningInvocation } from '../../../../utils/reasoningSerializers'
import { createCustomParamsFetch } from '../customParamsFetch'
import { encodeBodyPath, resolveReasoningOverrideBodyParams } from '../reasoningBodyParams'

const prompt: LanguageModelV3CallOptions['prompt'] = [
  { role: 'user', content: [{ type: 'text', text: 'Think before answering.' }] }
]

const invocation = (emissions: ResolvedReasoningInvocation['emissions'], kind: 'off' | 'effort' = 'off') =>
  ({
    kind,
    selection: kind === 'off' ? 'none' : 'low',
    emissions
  }) as ResolvedReasoningInvocation

describe('encodeBodyPath', () => {
  it('encodes flat and dotted wire paths as body objects', () => {
    expect(encodeBodyPath('reasoning_effort', 'none')).toEqual({ reasoning_effort: 'none' })
    expect(encodeBodyPath('reasoning.effort', 42)).toEqual({ reasoning: { effort: 42 } })
  })
})

describe('resolveReasoningOverrideBodyParams', () => {
  it('maps the effort emission to the endpoint body field', () => {
    expect(
      resolveReasoningOverrideBodyParams(invocation([{ target: 'reasoningEffort', value: 'none' }]), 'openai-responses')
    ).toEqual({ reasoning: { effort: 'none' } })
    expect(
      resolveReasoningOverrideBodyParams(
        invocation([{ target: 'reasoningEffort', value: 'none' }]),
        'openai-chat-completions'
      )
    ).toEqual({ reasoning_effort: 'none' })
  })

  it('keeps budget and toggle dialects on their providerOptions delivery', () => {
    expect(
      resolveReasoningOverrideBodyParams(invocation([{ target: 'think', value: false }]), 'ollama' as any)
    ).toEqual({})
  })

  it('emits nothing when the invocation carries no effort knob value', () => {
    expect(
      resolveReasoningOverrideBodyParams(
        invocation([{ target: 'reasoningSummary', value: 'auto' }]),
        'openai-responses'
      )
    ).toEqual({})
  })
})

// Contract: the user override reaches the wire even where the AI SDK's per-model
// ladder would strip it — the SDK drops `reasoningEffort: 'none'` for gpt-6-sol
// before serialization, so delivery happens at the body layer below.
describe('user effort override request body', () => {
  async function generateWithOverride(
    providerOptionsEffort: string | undefined,
    overrideBodyParams: Record<string, unknown>
  ): Promise<any> {
    let requestBody: any = {}
    const innerFetch = async (_input: RequestInfo | URL, init?: RequestInit) => {
      requestBody = JSON.parse(init?.body as string)
      return new Response(
        JSON.stringify({
          id: 'resp_1',
          created_at: 0,
          model: 'gpt-6-sol',
          status: 'completed',
          output: [],
          usage: { input_tokens: 1, output_tokens: 1 }
        }),
        { headers: { 'content-type': 'application/json' } }
      )
    }
    const model = createOpenAI({
      apiKey: 'test',
      baseURL: 'https://chatgpt.com/backend-api/codex',
      fetch: createCustomParamsFetch(innerFetch, overrideBodyParams)
    }).responses('gpt-6-sol')

    await model.doGenerate({
      prompt,
      ...(providerOptionsEffort !== undefined
        ? { providerOptions: { openai: { reasoningEffort: providerOptionsEffort } } }
        : {})
    })
    return requestBody
  }

  it('sends reasoning.effort "none" to the wire although the SDK ladder lacks it', async () => {
    const body = await generateWithOverride(
      'none',
      resolveReasoningOverrideBodyParams(invocation([{ target: 'reasoningEffort', value: 'none' }]), 'openai-responses')
    )

    expect(body.reasoning?.effort).toBe('none')
  })

  it('does not clobber an SDK-written effort sibling when both paths carry the same value', async () => {
    const body = await generateWithOverride('low', { reasoning: { effort: 'low' } })

    expect(body.reasoning?.effort).toBe('low')
  })

  it('keeps SDK-written nested siblings beside injected leaves', async () => {
    const body = await generateWithOverride('low', { reasoning: { effort: 'low' }, store: false })

    expect(body.reasoning?.effort).toBe('low')
  })

  it('preserves advanced param value types at the wire (integer effort stays a number)', async () => {
    const body = await generateWithOverride(undefined, { reasoning: { effort: 42 } })

    expect(body.reasoning?.effort).toBe(42)
    expect(typeof body.reasoning?.effort).toBe('number')
  })
})
