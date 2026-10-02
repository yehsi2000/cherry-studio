import { ArrowLeft, MessageSquare } from 'lucide-react'
import type { FC } from 'react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'

import { Button, Separator, Tooltip } from '@cherrystudio/ui'
import { dataApiService } from '@data/DataApiService'
import { loggerService } from '@logger'
import { getTopicMessages } from '@renderer/hooks/useTopic'
import { getTextFromParts } from '@renderer/utils/message/partsHelpers'
import type { Topic } from '@shared/data/types/topic'

const logger = loggerService.withContext('QuickAssistantHistory')

interface HistoryMenuProps {
  limit: number
  onClose: () => void
}

/**
 * Read-only history of quick-assistant conversations. Lists the most recent
 * promoted topics on demand and shows one topic's persisted messages fetched
 * fresh from storage — never a UI state snapshot.
 */
const HistoryMenu: FC<HistoryMenuProps> = ({ limit, onClose }) => {
  const { t } = useTranslation()
  const [topics, setTopics] = useState<Topic[] | null>(null)
  const [selected, setSelected] = useState<Topic | null>(null)
  const [messages, setMessages] = useState<{ id: string; role: string; text: string }[] | null>(null)

  useEffect(() => {
    let cancelled = false
    void (async () => {
      try {
        const response = await dataApiService.get('/topics', {
          query: { source: 'quick_assistant', limit }
        })
        if (!cancelled) setTopics(response.items)
      } catch (err) {
        logger.warn('Failed to load quick assistant history', err as Error)
        if (!cancelled) setTopics([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [limit])

  useEffect(() => {
    if (!selected) return
    let cancelled = false
    setMessages(null)
    void (async () => {
      try {
        const rows = await getTopicMessages(selected.id)
        if (cancelled) return
        setMessages(
          rows.map((message) => ({
            id: message.id,
            role: message.role,
            text: getTextFromParts(message.parts)
          }))
        )
      } catch (err) {
        logger.warn('Failed to load quick assistant history messages', err as Error)
        if (!cancelled) setMessages([])
      }
    })()
    return () => {
      cancelled = true
    }
  }, [selected])

  return (
    <div data-ui="quick-assistant.history" className="flex min-h-0 flex-1 flex-col gap-2 overflow-hidden">
      <div className="drag flex items-center gap-2">
        {selected ? (
          <Button
            variant="ghost"
            size="sm"
            className="nodrag h-7 px-2"
            onClick={() => {
              setSelected(null)
              setMessages(null)
            }}>
            <ArrowLeft size={14} />
            {t('quickAssistant.history.back')}
          </Button>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <MessageSquare size={14} />
            {t('quickAssistant.history.title')}
          </span>
        )}
        <div className="flex-1" />
        <Tooltip content={t('quickAssistant.history.close')} placement="left">
          <Button variant="ghost" size="sm" className="nodrag h-7 px-2" onClick={onClose}>
            {t('quickAssistant.history.close')}
          </Button>
        </Tooltip>
      </div>
      <Separator />
      <div className="min-h-0 flex-1 overflow-y-auto">
        {selected ? (
          <div className="flex flex-col gap-2 px-1 py-1">
            <div className="text-xs font-medium break-all">{selected.name || t('quickAssistant.history.untitled')}</div>
            {messages === null ? (
              <div className="text-xs text-muted-foreground">{t('quickAssistant.history.loading')}</div>
            ) : (
              messages
                .filter((message) => message.text.length > 0)
                .map((message) => (
                  <div key={message.id} className="rounded border px-2 py-1.5">
                    <div className="mb-0.5 text-[10px] text-muted-foreground">
                      {message.role === 'user'
                        ? t('quickAssistant.history.role_user')
                        : t('quickAssistant.history.role_assistant')}
                    </div>
                    <div className="text-xs whitespace-pre-wrap break-words">{message.text}</div>
                  </div>
                ))
            )}
          </div>
        ) : topics === null ? (
          <div className="px-1 py-1 text-xs text-muted-foreground">{t('quickAssistant.history.loading')}</div>
        ) : topics.length === 0 ? (
          <div className="px-1 py-1 text-xs text-muted-foreground">{t('quickAssistant.history.empty')}</div>
        ) : (
          <div className="flex flex-col gap-1 px-1 py-1">
            {topics.map((topic) => (
              <button
                key={topic.id}
                type="button"
                className="nodrag rounded px-2 py-1.5 text-left text-xs transition-colors hover:bg-accent"
                onClick={() => setSelected(topic)}>
                <div className="truncate">{topic.name || t('quickAssistant.history.untitled')}</div>
                <div className="text-[10px] text-muted-foreground">
                  {new Date(topic.lastActivityAt).toLocaleString()}
                </div>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

export default HistoryMenu
