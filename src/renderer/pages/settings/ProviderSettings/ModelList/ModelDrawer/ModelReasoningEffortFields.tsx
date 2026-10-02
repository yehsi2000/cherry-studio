import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { REASONING_EFFORT_ORDER, type ReasoningEffort } from '@cherrystudio/provider-registry'
import {
  Button,
  Checkbox,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue
} from '@cherrystudio/ui'
import type { UserReasoningEffortOverride } from '@shared/data/types/model'

import { drawerClasses } from '../../primitives/ProviderSettingsPrimitives'

const DEFAULT_CHOICE_UNSET = 'unset'

const EFFORT_LABEL_KEYS: Record<ReasoningEffort, string> = {
  none: 'models.reasoning_effort.value.none',
  minimal: 'models.reasoning_effort.value.minimal',
  low: 'models.reasoning_effort.value.low',
  medium: 'models.reasoning_effort.value.medium',
  high: 'models.reasoning_effort.value.high',
  xhigh: 'models.reasoning_effort.value.xhigh',
  max: 'models.reasoning_effort.value.max',
  ultra: 'models.reasoning_effort.value.ultra',
  auto: 'models.reasoning_effort.value.auto'
}

type EffortSource = 'catalog' | 'custom'

interface EffortDraft {
  source: EffortSource
  choices: ReasoningEffort[]
  defaultChoice: ReasoningEffort | null
}

interface ModelReasoningEffortFieldsProps {
  /** Saved user override; `null`/absent means the catalog vocabulary stands. */
  override: UserReasoningEffortOverride | null | undefined
  /** Effective vocabulary on the model (override already applied) — seeds the custom buffer. */
  effectiveChoices: readonly ReasoningEffort[] | undefined
  onApply: (override: UserReasoningEffortOverride | null) => void
}

function orderEfforts(efforts: Iterable<ReasoningEffort>): ReasoningEffort[] {
  const selected = new Set(efforts)
  return REASONING_EFFORT_ORDER.filter((effort) => selected.has(effort))
}

function toDraft(
  override: UserReasoningEffortOverride | null | undefined,
  effectiveChoices: readonly ReasoningEffort[] | undefined
): EffortDraft {
  const saved = override?.choices ?? effectiveChoices ?? []
  return {
    source: override ? 'custom' : 'catalog',
    choices: orderEfforts(saved),
    defaultChoice: override?.defaultChoice ?? null
  }
}

function sameChoices(a: readonly ReasoningEffort[], b: readonly ReasoningEffort[]): boolean {
  return a.length === b.length && a.every((effort, index) => effort === b[index])
}

/**
 * Editor for a model's user-defined reasoning effort vocabulary. The whole edit
 * runs through an explicit buffer + Apply so a half-edited list is never saved;
 * the only immediate write is Reset back to the catalog vocabulary.
 */
export function ModelReasoningEffortFields({ override, effectiveChoices, onApply }: ModelReasoningEffortFieldsProps) {
  const { t } = useTranslation()
  const [draft, setDraft] = useState<EffortDraft>(() => toDraft(override, effectiveChoices))
  const baselineRef = useRef(draft)

  const baseline = baselineRef.current
  const isDirty =
    draft.source !== baseline.source ||
    draft.defaultChoice !== baseline.defaultChoice ||
    !sameChoices(draft.choices, baseline.choices)
  const canApply = isDirty && (draft.source === 'catalog' || draft.choices.length > 0)

  const handleToggleChoice = (effort: ReasoningEffort, checked: boolean) => {
    setDraft((current) => {
      if (checked) {
        return { ...current, choices: orderEfforts([...current.choices, effort]) }
      }
      // A vocabulary with zero choices cannot be saved, so the last one is locked.
      if (current.choices.length <= 1) {
        return current
      }
      return {
        ...current,
        choices: current.choices.filter((choice) => choice !== effort),
        defaultChoice: current.defaultChoice === effort ? null : current.defaultChoice
      }
    })
  }

  const handleApply = () => {
    if (!canApply) {
      return
    }
    baselineRef.current = draft
    onApply(
      draft.source === 'catalog'
        ? null
        : {
            choices: [...draft.choices],
            ...(draft.defaultChoice ? { defaultChoice: draft.defaultChoice } : {})
          }
    )
  }

  const handleReset = () => {
    const next: EffortDraft = { ...draft, source: 'catalog', defaultChoice: null }
    setDraft(next)
    baselineRef.current = next
    onApply(null)
  }

  return (
    <div className={drawerClasses.field}>
      <div className="flex items-center justify-between gap-3">
        <div className={drawerClasses.fieldTitle}>{t('models.reasoning_effort.label')}</div>
        <SegmentedControl
          size="sm"
          aria-label={t('models.reasoning_effort.source.label')}
          value={draft.source}
          options={[
            { value: 'catalog', label: t('models.reasoning_effort.mode.catalog') },
            { value: 'custom', label: t('models.reasoning_effort.mode.custom') }
          ]}
          onValueChange={(source) => setDraft((current) => ({ ...current, source: source }))}
        />
      </div>

      {draft.source === 'custom' && (
        <>
          <div
            role="group"
            aria-label={t('models.reasoning_effort.choices.label')}
            className="flex flex-wrap items-center gap-x-4 gap-y-2">
            {REASONING_EFFORT_ORDER.map((effort) => {
              const checked = draft.choices.includes(effort)
              return (
                <label key={effort} className="flex cursor-pointer items-center gap-2 text-xs text-foreground">
                  <Checkbox
                    size="sm"
                    checked={checked}
                    disabled={checked && draft.choices.length === 1}
                    onCheckedChange={(next) => handleToggleChoice(effort, next === true)}
                  />
                  <span>{t(EFFORT_LABEL_KEYS[effort])}</span>
                </label>
              )
            })}
          </div>
          {draft.choices.length <= 1 && (
            <div className={drawerClasses.helpText}>{t('models.reasoning_effort.min_choices')}</div>
          )}
          <div className={drawerClasses.field}>
            <div className={drawerClasses.fieldTitle}>{t('models.reasoning_effort.default_choice.label')}</div>
            <Select
              value={draft.defaultChoice ?? DEFAULT_CHOICE_UNSET}
              onValueChange={(value) =>
                setDraft((current) => ({
                  ...current,
                  defaultChoice: value === DEFAULT_CHOICE_UNSET ? null : (value as ReasoningEffort)
                }))
              }>
              <SelectTrigger
                aria-label={t('models.reasoning_effort.default_choice.label')}
                className={drawerClasses.selectTrigger}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={drawerClasses.selectContent}>
                <SelectItem value={DEFAULT_CHOICE_UNSET} aria-label={t('models.reasoning_effort.default_choice.unset')}>
                  {t('models.reasoning_effort.default_choice.unset')}
                </SelectItem>
                {draft.choices.map((effort) => (
                  <SelectItem key={effort} value={effort} aria-label={t(EFFORT_LABEL_KEYS[effort])}>
                    {t(EFFORT_LABEL_KEYS[effort])}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          {/* Neutral fact at save time — the app never validates choices against the provider. */}
          <div className={drawerClasses.helpText}>{t('models.reasoning_effort.provider_warning')}</div>
        </>
      )}

      <div className={drawerClasses.footer}>
        <Button type="button" variant="ghost" size="sm" onClick={handleReset}>
          {t('models.reasoning_effort.reset')}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={!canApply} onClick={handleApply}>
          {t('models.reasoning_effort.apply')}
        </Button>
      </div>
    </div>
  )
}
