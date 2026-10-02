import { useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Textarea } from '@cherrystudio/ui'
import { ReasoningParamsOverrideSchema, type ReasoningParamsOverride } from '@shared/data/types/model'

import { drawerClasses } from '../../primitives/ProviderSettingsPrimitives'

type ParseResult = { ok: true; value: ReasoningParamsOverride } | { ok: false; error: 'json' | 'field' }

function parseParams(text: string): ParseResult | null {
  const trimmed = text.trim()
  if (trimmed === '') return { ok: true, value: {} }
  let raw: unknown
  try {
    raw = JSON.parse(trimmed)
  } catch {
    return { ok: false, error: 'json' }
  }
  if (raw === null || typeof raw !== 'object' || Array.isArray(raw)) {
    return { ok: false, error: 'field' }
  }
  const parsed = ReasoningParamsOverrideSchema.safeParse(raw)
  return parsed.success ? { ok: true, value: parsed.data } : { ok: false, error: 'field' }
}

interface ModelReasoningParamsFieldsProps {
  /** Saved advanced params; `null`/absent means nothing is injected. */
  params: ReasoningParamsOverride | null | undefined
  onApply: (params: ReasoningParamsOverride | null) => void
}

/**
 * Editor for the advanced reasoning wire params of one model. Only reviewed
 * reasoning wire fields are accepted and value types are kept exactly as
 * entered; whether the provider accepts a value stays the provider's call.
 */
export function ModelReasoningParamsFields({ params, onApply }: ModelReasoningParamsFieldsProps) {
  const { t } = useTranslation()
  const [text, setText] = useState(() =>
    params && Object.keys(params).length > 0 ? JSON.stringify(params, null, 2) : ''
  )
  const baselineRef = useRef(text)

  const isDirty = text !== baselineRef.current
  const result = text.trim() === baselineRef.current.trim() ? null : parseParams(text)
  const canApply = isDirty && result !== null && result.ok

  const handleApply = () => {
    if (!canApply || !result?.ok) return
    baselineRef.current = text
    onApply(Object.keys(result.value).length > 0 ? result.value : null)
  }

  const handleClear = () => {
    setText('')
    baselineRef.current = ''
    onApply(null)
  }

  return (
    <div className={drawerClasses.field}>
      <div className={drawerClasses.fieldTitle}>{t('models.reasoning_params.label')}</div>
      <div className={drawerClasses.helpText}>{t('models.reasoning_params.description')}</div>
      <Textarea.Input
        aria-label={t('models.reasoning_params.label')}
        value={text}
        rows={4}
        placeholder={t('models.reasoning_params.placeholder')}
        className="font-mono text-xs"
        onChange={(event) => setText(event.target.value)}
      />
      {result !== null && !result.ok && (
        <div className="text-xs text-error">
          {result.error === 'json'
            ? t('models.reasoning_params.invalid_json')
            : t('models.reasoning_params.invalid_field')}
        </div>
      )}
      <div className={drawerClasses.helpText}>{t('models.reasoning_effort.provider_warning')}</div>
      <div className={drawerClasses.footer}>
        <Button type="button" variant="ghost" size="sm" onClick={handleClear} disabled={!text}>
          {t('models.reasoning_params.clear')}
        </Button>
        <Button type="button" variant="secondary" size="sm" disabled={!canApply} onClick={handleApply}>
          {t('models.reasoning_params.apply')}
        </Button>
      </div>
    </div>
  )
}
