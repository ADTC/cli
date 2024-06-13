import {LogsContextOptions, ensureLogsContext} from './context.js'
import {renderLogs} from './app-logs/ui.js'
import {ExtensionSpecification} from '../models/extensions/specification.js'
import {DeveloperPlatformClient, selectDeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'
import {outputWarn, outputDebug} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {fetch} from '@shopify/cli-kit/node/http'

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

interface LogsConfig {
  developerPlatformClient: DeveloperPlatformClient
  storeId: string
  apiKey: string
}

export enum Flag {
  DeclarativeWebhooks,
}

export async function logs(commandOptions: LogsOptions) {
  const logsConfig = await prepareForLogs(commandOptions)

  const jwt = await subscribeProcess({logsConfig})

  if (!jwt) {
    return
  }

  const filters = {
    status: commandOptions.status,
    source: commandOptions.source,
  }

  await renderLogs({
    logsProcess: pollProcess,
    developerPlatformClient: logsConfig.developerPlatformClient,
    storeId: logsConfig.storeId,
    apiKey: logsConfig.apiKey,
    cursor: '',
    jwtToken: jwt.jwtToken,
    filters,
  })
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<LogsConfig> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: LogsContextOptions = {...commandOptions, developerPlatformClient}
  const {storeId, remoteApp} = await ensureLogsContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeId,
    developerPlatformClient,
    apiKey,
  }
}

export const subscribeProcess = async ({logsConfig}: {logsConfig: LogsConfig}) => {
  const appLogsSubscribeVariables = {
    shopIds: [logsConfig.storeId],
    apiKey: logsConfig.apiKey,
    token: '',
  }
  const result = await logsConfig.developerPlatformClient.subscribeToAppLogs(appLogsSubscribeVariables)
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

export const pollProcess = async ({
  jwtToken,
  cursor,
  filters,
}: {
  jwtToken: string
  cursor?: string
  filters?: {
    status?: string
    source?: string
  }
}): Promise<{
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
