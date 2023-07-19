/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  AppConfiguration,
  AppInterface,
  EmptyApp,
  isCurrentAppSchema,
  isLegacyAppSchema,
} from '../../../models/app/app.js'
import {OrganizationApp} from '../../../models/organization.js'
import {selectConfigName} from '../../../prompts/config.js'
import {loadLocalExtensionsSpecifications} from '../../../models/extensions/load-specifications.js'
import {getAppConfigurationFileName, loadApp} from '../../../models/app/loader.js'
import {
  InvalidApiKeyErrorMessage,
  fetchOrCreateOrganizationApp,
  fetchOrgsAppsAndStores,
  selectOrg,
} from '../../context.js'
import {fetchAppFromApiKey} from '../../dev/fetch.js'
import {configurationFileNames} from '../../../constants.js'
import {writeAppConfigurationFile} from '../write-app-configuration-file.js'
import {getCachedCommandInfo} from '../../local-storage.js'
import {createAsNewAppPrompt, selectAppPrompt} from '../../../prompts/dev.js'
import {createApp} from '../../dev/select-app.js'
import {Config} from '@oclif/core'
import {ensureAuthenticatedPartners} from '@shopify/cli-kit/node/session'
import {AbortError} from '@shopify/cli-kit/node/error'

export interface LinkOptions {
  commandConfig: Config
  directory: string
  apiKey?: string
  configName?: string
}

async function transition({state, options}: {state: any; options: any}) {
  await machine.states[state].render(options)
}

const machine: any = {
  initial: 'start',
  states: {
    start: {
      render: async (options: any) => {
        const localApp = await loadAppConfigFromDefaultToml(options)
        const token = await ensureAuthenticatedPartners()
        const orgId = await selectOrg(token)
        const {organization, apps} = await fetchOrgsAppsAndStores(orgId, token)
        const createNewApp = await createAsNewAppPrompt()

        await writeAppConfigurationFile(configFilePath, configuration)
        const nextOptions = {...options, organization, apps, localApp}

        if (createNewApp) {
          await transition({state: 'newApp', options: nextOptions})
        } else {
          await transition({state: 'existingApp', options: nextOptions})
        }
      },
    },
    newApp: {
      render: async (options: any) => {
        const token = await ensureAuthenticatedPartners()
        const app = await createApp(options.organization, options.localApp.name, token, options)

        const nextOptions = {...options, app}

        await transition({state: 'success', options: nextOptions})
      },
    },
    existingApp: {
      render: async (options: any) => {
        const token = await ensureAuthenticatedPartners()
        const selectedAppApiKey = await selectAppPrompt(options.apps, options.organization.id, options.token, {
          directory: options?.directory,
        })

        const fullSelectedApp = await fetchAppFromApiKey(selectedAppApiKey, token)

        const nextOptions = {...options, fullSelectedApp}

        await transition({state: 'success', options: nextOptions})
      },
    },
    chooseConfigName: {
      render: async () => {},
    },
    success: {
      render: async () => {
        console.log('success!')
      },
    },
  },
}

export default async function link(options: LinkOptions, shouldRenderSuccess = true): Promise<any> {
  await transition({state: machine.initial, options})

  return {data: 'foo'}

  // const localApp = await loadAppConfigFromDefaultToml(options)
  // const remoteApp = await loadRemoteApp(localApp, options.apiKey, options.directory)
  // const configFileName = await loadConfigurationFileName(remoteApp, options, localApp)
  // const configFilePath = joinPath(options.directory, configFileName)

  // const configuration = mergeAppConfiguration(localApp, remoteApp)

  // writeFileSync(configFilePath, encodeToml(configuration))

  // await saveCurrentConfig({configFileName, directory: options.directory})

  // if (shouldRenderSuccess) {
  //   renderSuccess({
  //     headline: `${configFileName} is now linked to "${remoteApp.title}" on Shopify`,
  //     body: `Using ${configFileName} as your default config.`,
  //     nextSteps: [
  //       [`Make updates to ${configFileName} in your local project`],
  //       ['To upload your config, run', {command: 'shopify app config push'}],
  //     ],
  //     reference: [
  //       {
  //         link: {
  //           label: 'App configuration',
  //           url: 'https://shopify.dev/docs/apps/tools/cli/configuration',
  //         },
  //       },
  //     ],
  //   })
  // }

  // return configuration
}

async function loadAppConfigFromDefaultToml(options: LinkOptions): Promise<AppInterface> {
  try {
    const specifications = await loadLocalExtensionsSpecifications(options.commandConfig)
    const app = await loadApp({
      specifications,
      directory: options.directory,
      mode: 'report',
      configName: configurationFileNames.app,
    })
    return app
    // eslint-disable-next-line no-catch-all/no-catch-all
  } catch (error) {
    return new EmptyApp()
  }
}

async function loadRemoteApp(
  localApp: AppInterface,
  apiKey: string | undefined,
  directory?: string,
): Promise<OrganizationApp> {
  const token = await ensureAuthenticatedPartners()
  if (!apiKey) {
    return fetchOrCreateOrganizationApp(localApp, token, directory)
  }
  const app = await fetchAppFromApiKey(apiKey, token)
  if (!app) {
    const errorMessage = InvalidApiKeyErrorMessage(apiKey)
    throw new AbortError(errorMessage.message, errorMessage.tryMessage)
  }
  return app
}

async function loadConfigurationFileName(
  remoteApp: OrganizationApp,
  options: LinkOptions,
  localApp?: AppInterface,
): Promise<string> {
  const cache = getCachedCommandInfo()

  if (!cache?.askConfigName && cache?.selectedToml) return cache.selectedToml as string

  if (options.configName) {
    return getAppConfigurationFileName(options.configName)
  }

  if (!localApp?.configuration || (localApp && isLegacyAppSchema(localApp.configuration))) {
    return configurationFileNames.app
  }

  const configName = await selectConfigName(options.directory, remoteApp.title)
  return `shopify.app.${configName}.toml`
}

export function mergeAppConfiguration(localApp: AppInterface, remoteApp: OrganizationApp): AppConfiguration {
  const configuration: AppConfiguration = {
    client_id: remoteApp.apiKey,
    name: remoteApp.title,
    application_url: remoteApp.applicationUrl.replace(/\/$/, ''),
    embedded: remoteApp.embedded === undefined ? true : remoteApp.embedded,
    webhooks: {
      api_version: remoteApp.webhookApiVersion || '2023-07',
    },
    auth: {
      redirect_urls: remoteApp.redirectUrlWhitelist,
    },
    pos: {
      embedded: remoteApp.posEmbedded || false,
    },
  }

  const hasAnyPrivacyWebhook =
    remoteApp.gdprWebhooks?.customerDataRequestUrl ||
    remoteApp.gdprWebhooks?.customerDeletionUrl ||
    remoteApp.gdprWebhooks?.shopDeletionUrl

  if (hasAnyPrivacyWebhook) {
    configuration.webhooks.privacy_compliance = {
      customer_data_request_url: remoteApp.gdprWebhooks?.customerDataRequestUrl,
      customer_deletion_url: remoteApp.gdprWebhooks?.customerDeletionUrl,
      shop_deletion_url: remoteApp.gdprWebhooks?.shopDeletionUrl,
    }
  }

  if (remoteApp.appProxy?.url) {
    configuration.app_proxy = {
      url: remoteApp.appProxy.url,
      subpath: remoteApp.appProxy.subPath,
      prefix: remoteApp.appProxy.subPathPrefix,
    }
  }

  if (remoteApp.preferencesUrl) {
    configuration.app_preferences = {url: remoteApp.preferencesUrl}
  }

  configuration.access_scopes = getAccessScopes(localApp, remoteApp)

  if (localApp.configuration?.extension_directories) {
    configuration.extension_directories = localApp.configuration.extension_directories
  }

  if (localApp.configuration?.web_directories) {
    configuration.web_directories = localApp.configuration.web_directories
  }

  if (isCurrentAppSchema(localApp.configuration) && localApp.configuration?.build) {
    configuration.build = localApp.configuration.build
  }

  return configuration
}

const getAccessScopes = (localApp: AppInterface, remoteApp: OrganizationApp) => {
  // if we have upstream scopes, use them
  if (remoteApp.requestedAccessScopes) {
    return {
      scopes: remoteApp.requestedAccessScopes.join(','),
    }
    // if we have scopes locally and not upstream, preserve them but don't push them upstream (legacy is true)
  } else if (isLegacyAppSchema(localApp.configuration) && localApp.configuration.scopes) {
    return {
      scopes: localApp.configuration.scopes,
      use_legacy_install_flow: true,
    }
  } else if (isCurrentAppSchema(localApp.configuration) && localApp.configuration.access_scopes?.scopes) {
    return {
      scopes: localApp.configuration.access_scopes.scopes,
      use_legacy_install_flow: true,
    }
    // if we can't find scopes or have to fall back, omit setting a scope and set legacy to true
  } else {
    return {
      use_legacy_install_flow: true,
    }
  }
}
