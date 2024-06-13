import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {outputWarn, outputDebug} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface AppLogData {
  shop_id: number
  api_client_id: number
  payload: string
  log_type: string
  source: string
  source_namespace: string
  cursor: string
  status: 'success' | 'failure'
  log_timestamp: string
}

export interface DetailsFunctionRunLogEvent {
  input: string
  inputBytes: number
  invocationId: string
  output: unknown
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  errorMessage: string | null
  errorType: string | null
}

export function parseFunctionRunPayload(payload: string): DetailsFunctionRunLogEvent {
  const parsedPayload = JSON.parse(payload)
  return {
    input: parsedPayload.input,
    inputBytes: parsedPayload.input_bytes,
    output: parsedPayload.output,
    outputBytes: parsedPayload.output_bytes,
    logs: parsedPayload.logs,
    invocationId: parsedPayload.invocation_id,
    functionId: parsedPayload.function_id,
    fuelConsumed: parsedPayload.fuel_consumed,
    errorMessage: parsedPayload.error_message,
    errorType: parsedPayload.error_type,
  }
}

export interface SubscribeOptions {
  developerPlatformClient: DeveloperPlatformClient
  storeId: string
  apiKey: string
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
    throw new AbortError(errors.join(', '))
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }
  return jwtToken
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
  appLogs?: AppLogData[]
}

export type LogsProcess = (pollOptions: PollOptions) => Promise<PollResponse>

export const pollProcess = async ({
  jwtToken,
  cursor,
  filters,
}: PollOptions): Promise<{
  cursor?: string
  errors?: string[]
  appLogs?: AppLogData[]
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
      throw new AbortError(`Error while fetching: ${responseText}`)
    }
  }

  const data = (await response.json()) as {
    app_logs?: AppLogData[]
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
