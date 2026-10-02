import type { ResolvedReasoningInvocation } from '@main/ai/utils/reasoningSerializers'
import { EFFORT_BODY_PATH_BY_ENDPOINT, EFFORT_EMISSION_TARGETS } from '@shared/ai/reasoning'
import type { EndpointType } from '@shared/data/types/model'

/** Encode a dotted wire path as a (possibly nested) body object. */
export function encodeBodyPath(path: string, value: string | number | boolean): Record<string, unknown> {
  const keys = path.split('.')
  const result: Record<string, unknown> = {}
  let cursor = result
  for (let index = 0; index < keys.length - 1; index += 1) {
    const next: Record<string, unknown> = {}
    cursor[keys[index]] = next
    cursor = next
  }
  cursor[keys[keys.length - 1]] = value
  return result
}

/**
 * Body params delivering the invocation's resolved effort value for endpoints
 * whose wire carries an effort knob. Empty for any other endpoint — budget and
 * toggle dialects keep their providerOptions delivery.
 */
export function resolveReasoningOverrideBodyParams(
  invocation: ResolvedReasoningInvocation,
  endpointType: EndpointType | undefined
): Record<string, unknown> {
  const path = endpointType ? EFFORT_BODY_PATH_BY_ENDPOINT[endpointType] : undefined
  if (!path) return {}
  const emission = invocation.emissions.find((entry) => EFFORT_EMISSION_TARGETS.has(entry.target))
  if (!emission) return {}
  return encodeBodyPath(path, emission.value)
}
