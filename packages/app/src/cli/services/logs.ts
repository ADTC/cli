import {DevContextOptions, ensureDevContext} from './context.js'
import {renderLogs} from './app-logs/ui.js'
import {pollProcess, subscribeProcess} from './app-logs/processes/polling-app-logs.js'
import {selectDeveloperPlatformClient, DeveloperPlatformClient} from '../utilities/developer-platform-client.js'
import {loadAppConfiguration} from '../models/app/loader.js'

interface LogsOptions {
  directory: string
  reset: boolean
  json: boolean
  apiKey?: string
  storeFqdn?: string
  source?: string
  status?: string
  configName?: string
  userProvidedConfigName?: string
}

export async function logs(commandOptions: LogsOptions) {
  const logsConfig = await prepareForLogs(commandOptions)

  const subscribeOptions = {
    storeId: logsConfig.storeId,
    apiKey: logsConfig.apiKey,
    developerPlatformClient: logsConfig.developerPlatformClient,
  }

  const data = await subscribeProcess(subscribeOptions)

  if (!data?.jwtToken) {
    return
  }

  const filters = {
    status: commandOptions.status,
    source: commandOptions.source,
  }

  const pollOptions = {
    jwtToken: data.jwtToken,
    filters,
  }

  await renderLogs({
    logsProcess: pollProcess,
    subscribeOptions,
    pollOptions,
  })
}

async function prepareForLogs(commandOptions: LogsOptions): Promise<{
  storeId: string
  developerPlatformClient: DeveloperPlatformClient
  apiKey: string
}> {
  const {configuration} = await loadAppConfiguration({
    ...commandOptions,
    userProvidedConfigName: commandOptions.configName,
  })
  let developerPlatformClient = selectDeveloperPlatformClient({configuration})
  const devContextOptions: DevContextOptions = {...commandOptions, developerPlatformClient}
  const {storeId, remoteApp} = await ensureDevContext(devContextOptions)

  developerPlatformClient = remoteApp.developerPlatformClient ?? developerPlatformClient

  const apiKey = remoteApp.apiKey

  return {
    storeId,
    developerPlatformClient,
    apiKey,
  }
}
