import {appFlags} from '../../flags.js'
import {dev} from '../../services/dev.js'
import Command from '../../utilities/app-command.js'
import {showApiKeyDeprecationWarning} from '../../prompts/deprecation-warnings.js'
import {Flags} from '@oclif/core'
import {normalizeStoreFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {addPublicMetadata} from '@shopify/cli-kit/node/metadata'
import {io} from 'socket.io-client'

export default class Dev extends Command {
  static description = 'Run the app.'

  static flags = {
    ...globalFlags,
    ...appFlags,
    'api-key': Flags.string({
      hidden: true,
      description: 'The API key of your app.',
      env: 'SHOPIFY_FLAG_APP_API_KEY',
      exclusive: ['config'],
    }),
    'client-id': Flags.string({
      hidden: false,
      description: 'The Client ID of your app.',
      env: 'SHOPIFY_FLAG_CLIENT_ID',
      exclusive: ['config'],
    }),
    store: Flags.string({
      hidden: false,
      char: 's',
      description: 'Store URL. Must be an existing development or Shopify Plus sandbox store.',
      env: 'SHOPIFY_FLAG_STORE',
      parse: async (input) => normalizeStoreFqdn(input),
    }),
    reset: Flags.boolean({
      hidden: false,
      description: 'Reset all your settings.',
      env: 'SHOPIFY_FLAG_RESET',
      default: false,
      exclusive: ['config'],
    }),
    'skip-dependencies-installation': Flags.boolean({
      hidden: false,
      description: 'Skips the installation of dependencies. Deprecated, use workspaces instead.',
      env: 'SHOPIFY_FLAG_SKIP_DEPENDENCIES_INSTALLATION',
      default: false,
    }),
    'no-update': Flags.boolean({
      hidden: false,
      description: 'Skips the Partners Dashboard URL update step.',
      env: 'SHOPIFY_FLAG_NO_UPDATE',
      default: false,
    }),
    'subscription-product-url': Flags.string({
      hidden: false,
      description: 'Resource URL for subscription UI extension. Format: "/products/{productId}"',
      env: 'SHOPIFY_FLAG_SUBSCRIPTION_PRODUCT_URL',
    }),
    'checkout-cart-url': Flags.string({
      hidden: false,
      description: 'Resource URL for checkout UI extension. Format: "/cart/{productVariantID}:{productQuantity}"',
      env: 'SHOPIFY_FLAG_CHECKOUT_CART_URL',
    }),
    'tunnel-url': Flags.string({
      hidden: false,
      description:
        'Use a custom tunnel, it must be running before executing dev. Format: "https://my-tunnel-url:port".',
      env: 'SHOPIFY_FLAG_TUNNEL_URL',
      exclusive: ['no-tunnel', 'tunnel'],
    }),
    'no-tunnel': Flags.boolean({
      hidden: true,
      description: 'Automatic creation of a tunnel is disabled. Service entry point will listen to localhost instead',
      env: 'SHOPIFY_FLAG_NO_TUNNEL',
      default: false,
      exclusive: ['tunnel-url', 'tunnel'],
    }),
    theme: Flags.string({
      hidden: false,
      char: 't',
      description: 'Theme ID or name of the theme app extension host theme.',
      env: 'SHOPIFY_FLAG_THEME',
    }),
    'theme-app-extension-port': Flags.integer({
      hidden: false,
      description: 'Local port of the theme app extension development server.',
      env: 'SHOPIFY_FLAG_THEME_APP_EXTENSION_PORT',
    }),
    notify: Flags.string({
      description:
        'The file path or URL. The file path is to a file that you want updated on idle. The URL path is where you want a webhook posted to report on file changes.',
      env: 'SHOPIFY_FLAG_NOTIFY',
    }),
    'graphiql-port': Flags.integer({
      hidden: true,
      description: 'Local port of the GraphiQL development server.',
      env: 'SHOPIFY_FLAG_GRAPHIQL_PORT',
    }),
    'graphiql-key': Flags.string({
      hidden: true,
      description:
        'Key used to authenticate GraphiQL requests. Should be specified if exposing GraphiQL on a publicly accessible URL. By default, no key is required.',
      env: 'SHOPIFY_FLAG_GRAPHIQL_KEY',
    }),
  }

  public static analyticsStopCommand(): string | undefined {
    return 'app dev stop'
  }

  public async run(): Promise<void> {
    const socket = io('https://web.prd-s5y-app-event-realti-d91a.prod.shopifyapps.com', {transports: ['websocket']})
    const user = 'mock_session_token'
    const shopId = 123
    const appId = 456
    // const room = `shop-${shopId}-app-${appId}`
    const room = 'test'

    console.log(`connecting to room: ${room}`)

    socket.emit('signin', {user, room}, (error: string, history: {messages: [string]}) => {
      if (error) {
        console.error(error)
      } else if (history) {
        console.log('historic messages detected:')
        console.log(history.messages)
        console.log('end of historic messages')
      }
    })

    socket.on('message', (msg) => {
      console.log('message received: ', msg)
    })

    console.log('test')

    socket.on('notification', (msg: string) => {
      console.log('notification received: ', msg)
    })

    // Listen connect event
    socket.on('connect', () => {
      console.log('connected')
    })
    // [END cloudrun_websockets_listen]

    // Listen for disconnect event
    socket.on('disconnect', (err: string) => {
      console.log('server disconnected: ', err)
      if (err === 'io server disconnect') {
        // Reconnect manually if the disconnection was initiated by the server
        socket.connect()
      }
    })

    // [START cloudrun_websockets_reconnect]
    // Listen for reconnect event
    socket.io.on('reconnect', () => {
      console.log('reconnected')
      // Emit "updateSocketId" event to update the recorded socket ID with user and room
      socket.emit('updateSocketId', {user, room}, (error: string) => {
        if (error) {
          console.error(error)
        }
      })
    })

    setInterval(() => {
      console.log(`socket is connected: ${socket.connected}`)
    }, 1000)
    return

    const {flags} = await this.parse(Dev)

    if (!flags['api-key']) {
      if (process.env.SHOPIFY_API_KEY) {
        flags['api-key'] = process.env.SHOPIFY_API_KEY
      }
    }
    if (flags['api-key']) {
      await showApiKeyDeprecationWarning()
    }
    const apiKey = flags['client-id'] || flags['api-key']

    await addPublicMetadata(() => ({
      cmd_app_dependency_installation_skipped: flags['skip-dependencies-installation'],
      cmd_app_reset_used: flags.reset,
      cmd_dev_tunnel_type: flags['tunnel-url'] ? 'custom' : flags.tunnel,
    }))

    const commandConfig = this.config

    const devOptions = {
      directory: flags.path,
      configName: flags.config,
      apiKey,
      storeFqdn: flags.store,
      reset: flags.reset,
      update: !flags['no-update'],
      skipDependenciesInstallation: flags['skip-dependencies-installation'],
      commandConfig,
      subscriptionProductUrl: flags['subscription-product-url'],
      checkoutCartUrl: flags['checkout-cart-url'],
      tunnelUrl: flags['tunnel-url'],
      noTunnel: flags['no-tunnel'],
      theme: flags.theme,
      themeExtensionPort: flags['theme-app-extension-port'],
      notify: flags.notify,
      graphiqlPort: flags['graphiql-port'],
      graphiqlKey: flags['graphiql-key'],
    }

    await dev(devOptions)
  }
}
