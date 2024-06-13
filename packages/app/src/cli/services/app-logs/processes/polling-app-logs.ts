import {ExtensionSpecification} from '../../../models/extensions/specification.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {outputWarn, outputDebug} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'

export interface AppEventData {
  shop_id: number
  api_client_id: number
  payload: string
  event_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export interface AppEventData {
  shop_id: number
  api_client_id: number
  payload: string
  event_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export interface LogsOptions {
  apiKey?: string
  storeFqdn?: string
  path?: string
  source?: string
  status?: string
  configName?: string
  directory: string
  userProvidedConfigName?: string
  specifications?: ExtensionSpecification[]
  remoteFlags?: Flag[]
  reset: boolean
}

export interface SubscribeOptions {
  developerPlatformClient: DeveloperPlatformClient
  storeId: string
  apiKey: string
}

enum Flag {
  DeclarativeWebhooks,
}

export const subscribeProcess = async ({storeId, apiKey, developerPlatformClient}: SubscribeOptions) => {
  const appLogsSubscribeVariables = {
    shopIds: [storeId],
    apiKey,
    token: '',
  }
  const result = await developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
  const {jwtToken, success, errors} = result.appLogsSubscribe
  outputDebug(`Token: ${jwtToken}\n`)
  outputDebug(`API Key: ${appLogsSubscribeVariables.apiKey}\n`)
  if (errors && errors.length > 0) {
    outputWarn(`Errors subscribing to app logs: ${errors.join(', ')}`)
    outputWarn('App log streaming is not available in this `log` session.')
    return
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }
  return {jwtToken}
}

export interface PollOptions {
  jwtToken: string
  cursor?: string
  filters?: {
    status?: string
    source?: string
  }
}

interface PollResponse {
  cursor?: string
  errors?: string[]
  appLogs?: AppEventData[]
}

export type LogsProcess = (pollOptions: PollOptions) => Promise<PollResponse>

export const pollProcess = async ({
  jwtToken,
  cursor,
  filters,
}: PollOptions): Promise<{
  cursor?: string
  errors?: string[]
  appLogs?: AppEventData[]
}> => {
  const url = await generateFetchAppLogUrl(cursor, filters)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (!response.ok) {
    const responseText = await response.text()
    if (response.status === 401) {
      return {
        errors: [`${response.status}: ${response.statusText}`],
      }
    } else if (response.status === 429 || response.status >= 500) {
      return {
        errors: [`${response.status}: ${response.statusText}`],
      }
    } else {
      throw new Error(`Error while fetching: ${responseText}`)
    }
  }

  const data = (await response.json()) as {
    app_logs?: AppEventData[]
    cursor?: string
    errors?: string[]
  }

  return {
    cursor: data.cursor,
    errors: data.errors,
    appLogs: data.app_logs,
  }
}

const generateFetchAppLogUrl = async (
  cursor?: string,
  filters?: {
    status?: string
    source?: string
  },
) => {
  const fqdn = await partnersFqdn()
  let url = `https://${fqdn}/app_logs/poll`

  if (!cursor) {
    return url
  }

  url += `?cursor=${cursor}`

  if (filters?.status) {
    url += `&status=${filters.status}`
  }
  if (filters?.source) {
    url += `&source=${filters.source}`
  }

  return url
}
