import {SubscribeOptions, PollOptions, AppLogData} from '../types.js'
import {outputWarn, outputDebug} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'

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
