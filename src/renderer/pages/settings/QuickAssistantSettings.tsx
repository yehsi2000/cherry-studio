import { useNavigate } from '@tanstack/react-router'
import { Check, ChevronDown, Info } from 'lucide-react'
import type React from 'react'
import type { FC } from 'react'
import { useEffect, useId, useState } from 'react'
import { useTranslation } from 'react-i18next'

import {
  Button,
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  Input,
  InfoTooltip,
  Popover,
  PopoverContent,
  PopoverTrigger,
  RowFlex,
  SegmentedControl,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch
} from '@cherrystudio/ui'
import { dataApiService } from '@data/DataApiService'
import { usePreference } from '@data/hooks/usePreference'
import ModelAvatar from '@renderer/components/Avatar/ModelAvatar'
import { ModelSettingsNavigation } from '@renderer/components/ModelSettingsNavigation'
import {
  SettingDivider,
  SettingGroup,
  SettingRow,
  SettingRowTitle,
  SettingsContentColumn,
  SettingTitle
} from '@renderer/components/SettingsPrimitives'
import { useAssistants } from '@renderer/hooks/useAssistant'
import { useDefaultModel } from '@renderer/hooks/useModel'
import { useTheme } from '@renderer/hooks/useTheme'
import { ipcApi } from '@renderer/ipc'
import { toast } from '@renderer/services/toast'
import type { Assistant } from '@renderer/types/assistant'
import { cn } from '@renderer/utils/style'
import HomeWindow from '@renderer/windows/quickAssistant/home/HomeWindow'
import type { Model } from '@shared/data/types/model'

const QuickAssistantSettings: FC = () => {
  const [enableQuickAssistant, setEnableQuickAssistant] = usePreference('feature.quick_assistant.enabled')
  const [clickTrayToShowQuickAssistant, setClickTrayToShowQuickAssistant] = usePreference(
    'feature.quick_assistant.click_tray_to_show'
  )
  const [readClipboardAtStartup, setReadClipboardAtStartup] = usePreference(
    'feature.quick_assistant.read_clipboard_at_startup'
  )
  const [keepHistory, setKeepHistory] = usePreference('feature.quick_assistant.keep_history')
  const [historyLimit, setHistoryLimit] = usePreference('feature.quick_assistant.history_limit')
  const [quickAssistantReasoningEffort, setQuickAssistantReasoningEffort] = usePreference(
    'feature.quick_assistant.reasoning_effort'
  )
  const [, setTray] = usePreference('app.tray.enabled')
  const [quickAssistantId, setQuickAssistantId] = usePreference('feature.quick_assistant.assistant_id')

  const { t } = useTranslation()
  const { theme } = useTheme()
  const { assistants, hasLoaded: haveAssistantsLoaded } = useAssistants()
  const { defaultModel } = useDefaultModel()
  const navigate = useNavigate()
  const [assistantSelectOpen, setAssistantSelectOpen] = useState(false)
  const usageMethodTitleId = useId()
  const configurationTitleId = useId()

  const assistantOptions = assistants
  const firstAssistantId = assistantOptions[0]?.id
  const selectedAssistant = assistantOptions.find((assistant) => assistant.id === quickAssistantId)
  const isAssistantMode = Boolean(quickAssistantId && (!haveAssistantsLoaded || selectedAssistant))

  useEffect(() => {
    if (haveAssistantsLoaded && quickAssistantId && !selectedAssistant) {
      void setQuickAssistantId('')
    }
  }, [haveAssistantsLoaded, quickAssistantId, selectedAssistant, setQuickAssistantId])

  const handleAssistantSelect = (assistantId: string) => {
    void setQuickAssistantId(assistantId)
    setAssistantSelectOpen(false)
  }

  const handleEnableQuickAssistant = async (enable: boolean) => {
    await setEnableQuickAssistant(enable)

    void (!enable && ipcApi.request('quick_assistant.close'))

    if (enable && !clickTrayToShowQuickAssistant) {
      toast.info({
        title: t('settings.quickAssistant.use_shortcut_to_show'),
        timeout: 4000,
        icon: <Info size={16} />
      })
    }

    if (enable && clickTrayToShowQuickAssistant) {
      void setTray(true)
    }
  }

  const handleClickTrayToShowQuickAssistant = async (checked: boolean) => {
    await setClickTrayToShowQuickAssistant(checked)
    if (checked) void setTray(true)
  }

  const handleClickReadClipboardAtStartup = async (checked: boolean) => {
    await setReadClipboardAtStartup(checked)
    void ipcApi.request('quick_assistant.close')
  }

  const handleHistoryLimitChange = (value: string) => {
    const parsed = Number.parseInt(value, 10)
    if (Number.isFinite(parsed)) void setHistoryLimit(Math.min(100, Math.max(1, parsed)))
  }

  const handleDeleteAllHistory = async () => {
    if (!window.confirm(t('settings.quickAssistant.history_delete_confirm'))) return
    try {
      const response = await dataApiService.get('/topics', { query: { source: 'quick_assistant', limit: 100 } })
      for (const topic of response.items) {
        await dataApiService.delete(`/topics/${topic.id}`, { query: { permanent: true } })
      }
      toast.success(t('settings.quickAssistant.history_deleted'))
    } catch {
      toast.error(t('settings.quickAssistant.history_delete_failed'))
    }
  }

  return (
    <SettingsContentColumn theme={theme}>
      <SettingGroup theme={theme}>
        <SettingTitle>{t('settings.quickAssistant.title')}</SettingTitle>
        <SettingDivider />
        <SettingRow id="setting-quick-assistant-enable-quick-assistant" className="scroll-mt-6">
          <SettingRowTitle style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <span>{t('settings.quickAssistant.enable_quick_assistant')}</span>
            <InfoTooltip
              content={t('settings.quickAssistant.use_shortcut_to_show')}
              placement="right"
              iconProps={{ className: 'cursor-pointer' }}
            />
          </SettingRowTitle>
          <Switch checked={enableQuickAssistant} onCheckedChange={handleEnableQuickAssistant} />
        </SettingRow>
        {enableQuickAssistant && (
          <>
            <SettingDivider />
            <SettingRow>
              <SettingRowTitle>{t('settings.quickAssistant.click_tray_to_show')}</SettingRowTitle>
              <Switch checked={clickTrayToShowQuickAssistant} onCheckedChange={handleClickTrayToShowQuickAssistant} />
            </SettingRow>
          </>
        )}
        {enableQuickAssistant && (
          <>
            <SettingDivider />
            <SettingRow>
              <SettingRowTitle>{t('settings.quickAssistant.read_clipboard_at_startup')}</SettingRowTitle>
              <Switch checked={readClipboardAtStartup} onCheckedChange={handleClickReadClipboardAtStartup} />
            </SettingRow>
          </>
        )}
      </SettingGroup>
      {enableQuickAssistant && (
        <SettingGroup theme={theme}>
          <SettingTitle>{t('settings.models.quick_assistant_response_settings')}</SettingTitle>
          <SettingDivider />
          <SettingRow role="group" aria-labelledby={usageMethodTitleId} className="min-h-8.5 gap-3">
            <SettingRowTitle id={usageMethodTitleId}>
              {t('settings.models.quick_assistant_usage_method')}
            </SettingRowTitle>
            <SegmentedControl<'assistant' | 'model'>
              aria-label={t('settings.models.quick_assistant_usage_method')}
              size="sm"
              value={isAssistantMode ? 'assistant' : 'model'}
              options={[
                {
                  value: 'assistant',
                  label: t('settings.models.use_assistant'),
                  disabled: assistantOptions.length === 0
                },
                { value: 'model', label: t('settings.models.use_model') }
              ]}
              onValueChange={(value) => void setQuickAssistantId(value === 'assistant' ? (firstAssistantId ?? '') : '')}
            />
          </SettingRow>
          <SettingDivider />
          <SettingRow role="group" aria-labelledby={configurationTitleId} className="min-h-8.5 flex-nowrap gap-3">
            <SettingRowTitle id={configurationTitleId} className={isAssistantMode ? 'gap-2.5' : undefined}>
              {t(
                isAssistantMode
                  ? 'settings.models.quick_assistant_selection'
                  : 'settings.models.default_assistant_model'
              )}
              {isAssistantMode && (
                <InfoTooltip
                  content={t('selection.settings.user_modal.model.tooltip')}
                  showArrow
                  iconProps={{ className: 'cursor-pointer' }}
                />
              )}
            </SettingRowTitle>
            {isAssistantMode ? (
              selectedAssistant ? (
                <RowFlex className="items-center">
                  <Popover open={assistantSelectOpen} onOpenChange={setAssistantSelectOpen}>
                    <PopoverTrigger asChild>
                      <Button
                        variant="outline"
                        className="h-8.5 w-75 justify-between px-2 shadow-none"
                        aria-expanded={assistantSelectOpen}>
                        <AssistantOption
                          assistant={selectedAssistant}
                          firstAssistantId={firstAssistantId}
                          defaultModel={defaultModel}
                        />
                        <ChevronDown size={16} className="shrink-0 opacity-50" />
                      </Button>
                    </PopoverTrigger>
                    <PopoverContent
                      className="w-75 p-0"
                      align="end"
                      onFocusOutside={(event) => {
                        // The embedded quick assistant preview auto-focuses its input on render.
                        event.preventDefault()
                      }}>
                      <Command>
                        <CommandInput placeholder={t('settings.models.quick_assistant_selection')} />
                        <CommandList>
                          <CommandEmpty>{t('common.no_results')}</CommandEmpty>
                          <CommandGroup>
                            {assistantOptions.map((assistant) => (
                              <CommandItem
                                key={assistant.id}
                                value={`${assistant.name} ${assistant.id}`}
                                keywords={[assistant.name, assistant.id]}
                                onSelect={() => {
                                  handleAssistantSelect(assistant.id)
                                }}>
                                <AssistantOption
                                  assistant={assistant}
                                  firstAssistantId={firstAssistantId}
                                  defaultModel={defaultModel}
                                />
                                {assistant.id === quickAssistantId && (
                                  <Check size={14} className="ml-auto text-primary" />
                                )}
                              </CommandItem>
                            ))}
                          </CommandGroup>
                        </CommandList>
                      </Command>
                    </PopoverContent>
                  </Popover>
                </RowFlex>
              ) : null
            ) : (
              <ModelSettingsNavigation
                model={defaultModel}
                onNavigate={() => void navigate({ to: '/settings/model', search: { focus: 'default' } })}
              />
            )}
          </SettingRow>
          {!isAssistantMode && (
            <>
              <SettingDivider />
              <SettingRow>
                <SettingRowTitle>{t('settings.models.quick_assistant_reasoning_effort')}</SettingRowTitle>
                <Select
                  value={quickAssistantReasoningEffort ?? 'default'}
                  onValueChange={(value) => void setQuickAssistantReasoningEffort(value)}>
                  <SelectTrigger className="w-40">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {QUICK_ASSISTANT_EFFORT_OPTIONS.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {t(option.labelKey)}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </SettingRow>
            </>
          )}
        </SettingGroup>
      )}
      {enableQuickAssistant && (
        <SettingGroup theme={theme}>
          <SettingTitle>{t('settings.quickAssistant.history_title')}</SettingTitle>
          <SettingDivider />
          <SettingRow>
            <SettingRowTitle>{t('settings.quickAssistant.keep_history')}</SettingRowTitle>
            <Switch checked={keepHistory} onCheckedChange={(checked) => void setKeepHistory(checked)} />
          </SettingRow>
          {keepHistory && (
            <>
              <SettingDivider />
              <SettingRow>
                <SettingRowTitle>{t('settings.quickAssistant.history_limit')}</SettingRowTitle>
                <Input
                  type="number"
                  min={1}
                  max={100}
                  className="w-20"
                  value={String(historyLimit)}
                  onChange={(event) => handleHistoryLimitChange(event.target.value)}
                />
              </SettingRow>
              <SettingDivider />
              <SettingRow>
                <SettingRowTitle>{t('settings.quickAssistant.history_delete_all')}</SettingRowTitle>
                <Button variant="destructive" size="sm" onClick={() => void handleDeleteAllHistory()}>
                  {t('settings.quickAssistant.history_delete_all')}
                </Button>
              </SettingRow>
            </>
          )}
        </SettingGroup>
      )}
      {enableQuickAssistant && (
        <div className="mx-auto mt-5 h-115 w-full overflow-hidden rounded-[10px] border-[0.5px] border-border bg-background">
          {/* Preview must never persist its test conversations into history. */}
          <HomeWindow draggable={false} preview />
        </div>
      )}
    </SettingsContentColumn>
  )
}

const QUICK_ASSISTANT_EFFORT_OPTIONS = [
  { value: 'default', labelKey: 'models.reasoning_effort.value.default' },
  { value: 'none', labelKey: 'models.reasoning_effort.value.none' },
  { value: 'minimal', labelKey: 'models.reasoning_effort.value.minimal' },
  { value: 'low', labelKey: 'models.reasoning_effort.value.low' },
  { value: 'medium', labelKey: 'models.reasoning_effort.value.medium' },
  { value: 'high', labelKey: 'models.reasoning_effort.value.high' },
  { value: 'xhigh', labelKey: 'models.reasoning_effort.value.xhigh' },
  { value: 'max', labelKey: 'models.reasoning_effort.value.max' },
  { value: 'ultra', labelKey: 'models.reasoning_effort.value.ultra' },
  { value: 'auto', labelKey: 'models.reasoning_effort.value.auto' }
] as const

const AssistantOption = ({
  assistant,
  firstAssistantId,
  defaultModel
}: {
  assistant: Assistant
  firstAssistantId?: string
  defaultModel: Model | undefined
}) => {
  const { t } = useTranslation()
  const isDefault = !!firstAssistantId && assistant.id === firstAssistantId

  return (
    <AssistantItem>
      <ModelAvatar model={defaultModel} size={18} />
      <AssistantName>{assistant.name}</AssistantName>
      <Spacer />
      {isDefault && <DefaultTag isCurrent={true}>{t('settings.models.quick_assistant_default_tag')}</DefaultTag>}
    </AssistantItem>
  )
}

const AssistantItem = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('flex h-7 min-w-0 flex-1 flex-row items-center gap-2', className)} {...props} />
)

const AssistantName = ({ className, ...props }: React.ComponentPropsWithoutRef<'span'>) => (
  <span className={cn('max-w-[calc(100%-60px)] truncate', className)} {...props} />
)

const Spacer = ({ className, ...props }: React.ComponentPropsWithoutRef<'div'>) => (
  <div className={cn('flex-1', className)} {...props} />
)

const DefaultTag = ({
  className,
  isCurrent,
  ...props
}: React.ComponentPropsWithoutRef<'span'> & { isCurrent: boolean }) => (
  <span
    className={cn('rounded px-1 py-0.5 text-xs', isCurrent ? 'text-primary' : 'text-foreground-tertiary', className)}
    {...props}
  />
)

export default QuickAssistantSettings
