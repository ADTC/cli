import {LogsContextOptions, ensureLogsContext} from './context.js'
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
  storeFqdn: string
  storeId: string
  commandOptions: LogsOptions
  apiKey: string
}

export enum Flag {
  DeclarativeWebhooks,
}

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000
const ONE_MILLION = 1000000

export async function logs(commandOptions: LogsOptions) {
  const logsConfig = await prepareForLogs(commandOptions)

  const jwt = await subscribeProcess({logsConfig})

  if (!jwt) {
    return
  }

  await startPolling(jwt.jwtToken, '', pollProcess)
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<LogsConfig> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: LogsContextOptions = {...commandOptions, developerPlatformClient}
  const {storeFqdn, storeId, remoteApp} = await ensureLogsContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeFqdn,
    storeId,
    developerPlatformClient,
    commandOptions,
    apiKey,
  }
}

const subscribeProcess = async ({logsConfig}: {logsConfig: LogsConfig}) => {
  // Subscribe to logs and return the JWT token
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
    outputWarn('App log streaming is not available in this `dev` session.')
    return
  } else {
    outputDebug(`Subscribed to App Events for shop ID(s) ${appLogsSubscribeVariables.shopIds}`)
    outputDebug(`Success: ${success}\n`)
  }
  outputWarn(`[Subscribe Token]: ${jwtToken}`)
  return {jwtToken}
}

const pollProcess = async ({
  jwtToken,
  cursor,
}: {
  jwtToken: string
  cursor?: string
}): Promise<{
  cursor?: string
  errors?: string[]
}> => {
  const url = await generateFetchAppLogUrl(cursor)
  const response = await fetch(url, {
    method: 'GET',
    headers: {
      Authorization: `Bearer ${jwtToken}`,
    },
  })

  if (!response.ok) {
    const responseText = await response.text()
    if (response.status === 401) {
      // await resubscribeCallback()
    } else if (response.status === 429 || response.status >= 500) {
      // stdout.write(`Received an error while polling for app logs.`)
      // stdout.write(`${response.status}: ${response.statusText}`)
      // stdout.write(responseText)
      // stdout.write(`Retrying in ${POLLING_BACKOFF_INTERVAL_MS / 1000} seconds`)
      // setTimeout(() => {
      //   pollAppLogs({
      //     stdout,
      //     appLogsFetchInput: {
      //       jwtToken,
      //       cursor: undefined,
      //     },
      //     apiKey,
      //     resubscribeCallback,
      //   }).catch((error) => {
      //     outputDebug(`Unexpected error during polling: ${error}}\n`)
      //   })
      // }, POLLING_BACKOFF_INTERVAL_MS)
    } else {
      throw new Error(`Error while fetching: ${responseText}`)
    }
    return {errors: [responseText]}
  }

  const data = (await response.json()) as {
    app_logs?: AppEventData[]
    cursor?: string
    errors?: string[]
  }

  console.log(data.app_logs)

  return {
    cursor: data.cursor,
  }
}

const startPolling = async (
  jwtToken: string,
  cursor: string,
  process: ({jwtToken, cursor}: {jwtToken: string; cursor?: string | undefined}) => Promise<{
    cursor?: string | undefined
    errors?: string[] | undefined
  }>,
) => {
  const poll = async ({jwtToken, cursor}: {jwtToken: string; cursor: string}) => {
    const {cursor: newCursor, errors} = await process({jwtToken, cursor})
    if (errors) {
      // Handle errors
      return
    }
    // eslint-disable-next-line @typescript-eslint/no-misused-promises
    setTimeout(() => poll({jwtToken, cursor: newCursor || cursor}), POLLING_INTERVAL_MS)
  }
  await poll({
    jwtToken,
    cursor,
  })
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
