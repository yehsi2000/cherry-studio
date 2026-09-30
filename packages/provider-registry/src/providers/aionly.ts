import { defineProvider } from './types'

/**
 * AIOnly exposes New API-compatible `/models` metadata (`supported_endpoint_types`)
 * and multiplexes Anthropic / Gemini / OpenAI over one host. Without the `newapi`
 * adapter family, models synced as `anthropic-messages` or `google-generate-content`
 * still went through `openai-compatible` chat-completions and 400'd on tools or
 * attachments (issue #21166).
 */
export default defineProvider({
  id: 'aionly',
  name: 'AIOnly',
  availableInEditions: ['global'],
  defaultChatEndpoint: 'openai-chat-completions',
  endpointConfigs: {
    'anthropic-messages': {
      adapterFamily: 'newapi'
    },
    'openai-chat-completions': {
      adapterFamily: 'newapi',
      baseUrl: 'https://api.aiionly.com',
      reasoningFormat: { type: 'openai-chat' }
    },
    'openai-responses': {
      adapterFamily: 'newapi'
    },
    'google-generate-content': {
      adapterFamily: 'newapi'
    }
  },
  metadata: {
    website: {
      apiKey: 'https://maas.aiionly.com/keyApi',
      docs: 'https://maas.aiionly.com/document',
      models: 'https://maas.aiionly.com',
      official: 'https://www.aiionly.com'
    }
  }
})
