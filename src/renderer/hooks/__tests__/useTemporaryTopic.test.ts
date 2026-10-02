import { MockDataApiUtils } from '@test-mocks/renderer/DataApiService'
import { act, renderHook, waitFor } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { dataApiService } from '@data/DataApiService'

import { useTemporaryTopic } from '../useTemporaryTopic'

describe('useTemporaryTopic', () => {
  beforeEach(() => {
    MockDataApiUtils.resetMocks()
    vi.clearAllMocks()
    vi.mocked(dataApiService.post).mockImplementation(async (path) => {
      if (path === '/temporary/topics') return { id: 'temp-topic-1' } as never
      if (path === '/temporary/topics/temp-topic-1/persist') return undefined as never
      throw new Error(`Unexpected POST ${path}`)
    })
  })

  it('promotes with the seeded name and source in a single call', async () => {
    const { result } = renderHook(() => useTemporaryTopic({ enabled: true }))

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.persist({ name: ' Temporary title ', source: 'quick_assistant' })
    })

    expect(dataApiService.post).toHaveBeenCalledWith('/temporary/topics/temp-topic-1/persist', {
      body: { name: 'Temporary title', source: 'quick_assistant' }
    })
    expect(dataApiService.patch).not.toHaveBeenCalled()
  })

  it('does not persist a lone surrogate when the placeholder name cut lands inside an emoji', async () => {
    const { result } = renderHook(() => useTemporaryTopic({ enabled: true }))

    await waitFor(() => expect(result.current.ready).toBe(true))

    await act(async () => {
      await result.current.persist({ name: '字'.repeat(29) + '😀' + '文'.repeat(10), source: 'quick_assistant' })
    })

    expect(dataApiService.post).toHaveBeenCalledWith('/temporary/topics/temp-topic-1/persist', {
      body: { name: '字'.repeat(29), source: 'quick_assistant' }
    })
  })

  it('releases ownership synchronously so an unmount cannot race the save with a DELETE', async () => {
    let resolvePersist: (() => void) | undefined
    vi.mocked(dataApiService.post).mockImplementation(async (path) => {
      if (path === '/temporary/topics') return { id: 'temp-topic-1' } as never
      return new Promise<void>((resolve) => {
        resolvePersist = resolve
      }) as never
    })

    const { result, unmount } = renderHook(() => useTemporaryTopic({ enabled: true }))
    await waitFor(() => expect(result.current.ready).toBe(true))

    let persistPromise: Promise<void> | undefined
    act(() => {
      persistPromise = result.current.persist({ source: 'quick_assistant' })
    })
    unmount()

    await act(async () => {
      resolvePersist?.()
      await persistPromise
    })

    expect(dataApiService.delete).not.toHaveBeenCalledWith('/temporary/topics/temp-topic-1')
    expect(dataApiService.post).toHaveBeenCalledWith('/temporary/topics/temp-topic-1/persist', {
      body: { source: 'quick_assistant' }
    })
  })
})
