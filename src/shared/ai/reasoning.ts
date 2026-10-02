/** Provider-neutral reasoning vocabulary and budget policy shared by Main and Renderer. */
import {
  REASONING_EFFORT_ORDER,
  type ReasoningFormatType,
  type ReasoningWireMode,
  type ReasoningWireProfile
} from '@cherrystudio/provider-registry'
import {
  collectReasoningParamLeafPaths,
  ENDPOINT_TYPE,
  type EndpointType,
  type Model,
  type RuntimeReasoning,
  type UserReasoningEffortOverride
} from '@shared/data/types/model'
import type { ReasoningEffortOption } from '@shared/types/aiSdk'
import { isReasoningModel } from '@shared/utils/model'

type BudgetEffort = Exclude<ReasoningEffortOption, 'default' | 'none' | 'auto'>

const EFFORT_RATIO: Record<BudgetEffort, number> = {
  minimal: 0.05,
  low: 0.05,
  medium: 0.5,
  high: 0.8,
  xhigh: 0.9,
  max: 1,
  ultra: 1
}

const BUDGET_EFFORTS = ['low', 'medium', 'high', 'xhigh', 'max'] as const
const EFFORT_ORDER_INDEX = new Map<ReasoningEffortOption, number>(
  REASONING_EFFORT_ORDER.map((effort, index) => [effort, index])
)

export function deriveThinkingOptions(model: Model): ReasoningEffortOption[] | undefined {
  if (!isReasoningModel(model)) return undefined
  const vocabulary = model.reasoning?.selectableEfforts
  if (!vocabulary?.length) return undefined

  const rest = vocabulary.filter((effort) => effort !== 'none')
  return ['default', ...(vocabulary.includes('none') ? (['none'] as const) : []), ...rest]
}

/**
 * Body paths carrying the resolved reasoning effort, per endpoint wire. The
 * AI SDK maps its `reasoningEffort` provider option to these fields.
 */
export const EFFORT_BODY_PATH_BY_ENDPOINT: Partial<Record<EndpointType, string>> = {
  [ENDPOINT_TYPE.OPENAI_RESPONSES]: 'reasoning.effort',
  [ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS]: 'reasoning_effort'
}

const SUMMARY_BODY_PATH_BY_ENDPOINT: Partial<Record<EndpointType, string>> = {
  [ENDPOINT_TYPE.OPENAI_RESPONSES]: 'reasoning.summary'
}

/** Wire targets that carry the resolved effort value. */
export const EFFORT_EMISSION_TARGETS: ReadonlySet<string> = new Set([
  'reasoningEffort',
  'reasoning_effort',
  'reasoning.effort',
  'effort'
])

/**
 * Endpoint whose body mapping applies for a resolved reasoning format. Vendor
 * formats have no alias mapping — their wire targets are the body paths.
 */
export function reasoningEndpointForFormat(format: ReasoningFormatType): EndpointType {
  if (format === 'openai-responses') return ENDPOINT_TYPE.OPENAI_RESPONSES
  if (format === 'openai-chat') return ENDPOINT_TYPE.OPENAI_CHAT_COMPLETIONS
  return format as unknown as EndpointType
}

/** Request-body paths a wire target reaches for this endpoint. */
export function reasoningTargetBodyPaths(target: string, endpointType: EndpointType): string[] {
  if (EFFORT_EMISSION_TARGETS.has(target)) return [EFFORT_BODY_PATH_BY_ENDPOINT[endpointType] ?? target]
  if (target === 'reasoningSummary') return [SUMMARY_BODY_PATH_BY_ENDPOINT[endpointType] ?? target]
  return [target]
}

/**
 * Wire leaves the standard reasoning controls can write for this model and
 * endpoint, as body paths. Modes a user selection can never reach are excluded.
 */
export function reachableReasoningBodyPaths(
  reasoning: RuntimeReasoning | undefined,
  wire: ReasoningWireProfile,
  endpointType: EndpointType
): Set<string> {
  const paths = new Set<string>()
  if (!reasoning || wire.disabled) return paths
  const selectable = reasoning.selectableEfforts ?? []
  const tiers = selectable.filter((effort) => effort !== 'none' && effort !== 'auto')

  const modes: (ReasoningWireMode | undefined)[] = [wire.default]
  if (selectable.includes('none')) modes.push(wire.off)
  if (selectable.includes('auto') || tiers.length > 0) modes.push(wire.auto)
  if (tiers.length > 0) modes.push(wire.effort)

  for (const mode of modes) {
    for (const operation of mode?.operations ?? []) {
      for (const path of reasoningTargetBodyPaths(operation.target, endpointType)) paths.add(path)
    }
  }
  return paths
}

/**
 * Body paths where the advanced params would collide with the standard
 * reasoning controls (same field, two writers). Save paths must reject these.
 */
export function findReasoningParamsConflicts(
  params: Record<string, unknown>,
  input: { reasoning: RuntimeReasoning | undefined; wire: ReasoningWireProfile; endpointType: EndpointType }
): string[] {
  const reachable = reachableReasoningBodyPaths(input.reasoning, input.wire, input.endpointType)
  return collectReasoningParamLeafPaths(params)
    .map(({ path }) => path)
    .filter((path) => reachable.has(path))
}

/**
 * The single seam where a user-authored effort vocabulary replaces the
 * catalog-projected one. Renderer lists and the request pipeline must both go
 * through here so the visible choices and the transmitted effort cannot
 * diverge. A model without reasoning stays untouched — the override extends a
 * vocabulary, it never invents one.
 */
export function applyReasoningEffortOverride(
  reasoning: RuntimeReasoning | undefined,
  override: UserReasoningEffortOverride | null | undefined
): RuntimeReasoning | undefined {
  if (!reasoning || !override) return reasoning
  return { ...reasoning, selectableEfforts: [...override.choices] }
}

/** Resolve a persisted selection to the nearest effort exposed by the next model. */
export function nearestThinkingOption(
  target: ReasoningEffortOption,
  options: readonly ReasoningEffortOption[]
): ReasoningEffortOption | undefined {
  const selectable = options.filter((option): option is ReasoningEffortOption => option !== 'default')
  if (selectable.includes(target)) return target

  const targetIndex = EFFORT_ORDER_INDEX.get(target)
  if (targetIndex === undefined) return selectable[0]

  let best: ReasoningEffortOption | undefined
  let bestIndex = -1
  let bestDistance = Number.POSITIVE_INFINITY
  for (const option of selectable) {
    const index = EFFORT_ORDER_INDEX.get(option)
    if (index === undefined) continue
    const distance = Math.abs(index - targetIndex)
    if (distance < bestDistance || (distance === bestDistance && index > bestIndex)) {
      best = option
      bestIndex = index
      bestDistance = distance
    }
  }
  return best ?? selectable[0]
}

/** Project a persisted selection onto a model's renderer/runtime vocabulary. */
export function resolveReasoningEffortForModel(
  model: Model,
  currentEffort: ReasoningEffortOption | undefined
): ReasoningEffortOption | undefined {
  const supportedOptions = deriveThinkingOptions(model)
  if (!supportedOptions?.some((option) => option !== 'default')) return undefined
  if (currentEffort && supportedOptions.includes(currentEffort)) return currentEffort
  if (currentEffort !== undefined) return nearestThinkingOption(currentEffort, supportedOptions) ?? supportedOptions[0]
  return supportedOptions[0]
}

export function computeBudgetTokens(
  tokenLimit: { min: number; max: number },
  effortRatio: number,
  maxTokens?: number
): number {
  const budget = Math.max(1024, Math.floor((tokenLimit.max - tokenLimit.min) * effortRatio + tokenLimit.min))
  return maxTokens === undefined ? budget : Math.min(budget, maxTokens)
}

function resolveBudgetEffort(
  selection: ReasoningEffortOption,
  reasoning: RuntimeReasoning | undefined
): BudgetEffort | undefined {
  if (selection === 'default' || selection === 'none') return undefined
  const effort = selection === 'auto' ? (reasoning?.defaultEffort ?? 'high') : selection
  if (effort === 'none' || effort === 'auto') return effort === 'auto' ? 'high' : undefined
  return effort
}

/** Resolve a selection against descriptor-declared token limits. */
export function resolveBudgetTokens(
  selection: ReasoningEffortOption,
  reasoning: RuntimeReasoning | undefined,
  maxTokens?: number
): number | undefined {
  const limits = reasoning?.thinkingTokenLimits
  const effort = resolveBudgetEffort(selection, reasoning)
  if (limits?.min == null || limits.max == null || effort === undefined) return undefined
  return computeBudgetTokens({ min: limits.min, max: limits.max }, EFFORT_RATIO[effort], maxTokens)
}

/** Reverse a fixed thinking budget to the closest shared effort tier. */
export function nearestEffortForBudget(
  budget: number,
  tokenLimit: { min?: number; max?: number } | undefined
): ReasoningEffortOption | undefined {
  if (!Number.isFinite(budget) || tokenLimit?.min == null || tokenLimit.max == null) return undefined

  const limits = { min: tokenLimit.min, max: tokenLimit.max }
  let nearest: (typeof BUDGET_EFFORTS)[number] = BUDGET_EFFORTS[0]
  let nearestDistance = Number.POSITIVE_INFINITY

  for (const effort of BUDGET_EFFORTS) {
    const distance = Math.abs(budget - computeBudgetTokens(limits, EFFORT_RATIO[effort]))
    if (distance <= nearestDistance) {
      nearest = effort
      nearestDistance = distance
    }
  }

  return nearest
}

export function getThinkingBudget(
  maxTokens: number | undefined,
  selection: ReasoningEffortOption | undefined,
  reasoning: RuntimeReasoning | undefined
): number | undefined {
  return selection === undefined ? undefined : resolveBudgetTokens(selection, reasoning, maxTokens)
}
