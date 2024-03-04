import ThemeCommand from '../../utilities/theme-command.js'
import {globalFlags} from '@shopify/cli-kit/node/cli'
import {startServer} from '@shopify/theme-language-server-node'

export default class LanguageServer extends ThemeCommand {
  static summary = 'Start a Language Server Protocol server.'

  static description = `Starts the [Language Server](https://shopify.dev/docs/themes/tools/cli/language-server).`

  static flags = {
    ...globalFlags,
  }

  async run(): Promise<void> {
    const {flags} = await this.parse(LanguageServer)
    startServer()
  }
}
