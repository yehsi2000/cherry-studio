import { fireEvent, render, screen } from '@testing-library/react'
import type { ButtonHTMLAttributes, TextareaHTMLAttributes } from 'react'
import { describe, expect, it, vi } from 'vitest'

import { ModelReasoningParamsFields } from '../ModelReasoningParamsFields'

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (key: string) => key })
}))

vi.mock('@cherrystudio/ui', () => ({
  Button: ({
    variant,
    size,
    ...props
  }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: string; size?: string }) => {
    void variant
    void size
    return <button type="button" {...props} />
  },
  Textarea: {
    Input: (props: TextareaHTMLAttributes<HTMLTextAreaElement>) => <textarea {...props} />
  }
}))

function setup(params: Record<string, unknown> | null = null) {
  const onApply = vi.fn()
  render(<ModelReasoningParamsFields params={params as never} onApply={onApply} />)
  return { onApply }
}

describe('ModelReasoningParamsFields', () => {
  it('saves typed values exactly as entered through the reviewed-field schema', () => {
    const { onApply } = setup()
    const input = screen.getByLabelText('models.reasoning_params.label')

    fireEvent.change(input, { target: { value: '{"reasoning": {"effort": 42}}' } })
    fireEvent.click(screen.getByText('models.reasoning_params.apply'))

    expect(onApply).toHaveBeenCalledWith({ reasoning: { effort: 42 } })
  })

  it('rejects fields outside the reviewed reasoning wire set', () => {
    const { onApply } = setup()
    const input = screen.getByLabelText('models.reasoning_params.label')

    fireEvent.change(input, { target: { value: '{"api_key": "x"}' } })

    expect(screen.getByText('models.reasoning_params.invalid_field')).toBeTruthy()
    expect(screen.getByText('models.reasoning_params.apply')).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('rejects malformed JSON before it can be saved', () => {
    const { onApply } = setup()
    const input = screen.getByLabelText('models.reasoning_params.label')

    fireEvent.change(input, { target: { value: '{reasoning: }' } })

    expect(screen.getByText('models.reasoning_params.invalid_json')).toBeTruthy()
    expect(screen.getByText('models.reasoning_params.apply')).toBeDisabled()
    expect(onApply).not.toHaveBeenCalled()
  })

  it('removes the saved params with the clear action', () => {
    const { onApply } = setup({ reasoning: { effort: 42 } })

    fireEvent.click(screen.getByText('models.reasoning_params.clear'))

    expect(onApply).toHaveBeenCalledWith(null)
  })
})
