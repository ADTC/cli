import Dev from './dev.js'
import Command from '../../utilities/app-command.js'
import {checkFolderIsValidApp} from '../../models/app/loader.js'
import {logs} from '../../services/logs.js'
import {Flags} from '@oclif/core'

export default class Logs extends Command {
  static summary = 'Stream detailed logs for your Shopify app.'

  static descriptionWithMarkdown = `
  Opens a real-time stream of detailed log events from the selected app and store. Use the \`--source\` argument to limit output to a particular log source, such as a Shopify Function or webhook topic. Use the \`sources\` subcommand to list available sources.
  The \`--json\` argument can be used to receive log entries as line-delimited JSON (JSONL). By piping the output to tools like \`jq\`, you can filter the output to specific information.
  \`\`\`
  shopify app logs --json
  \`\`\`
  `

  static description = this.descriptionWithoutMarkdown()

  static flags = {
    ...Dev.flags,
    source: Flags.string({
      description: 'Filters output to the specified log source (Multiple flags allowed).',
      env: 'SHOPIFY_FLAG_SOURCE',
    }),
    status: Flags.string({
      description: 'Filters output to the specified status (success or failure).',
      env: 'SHOPIFY_FLAG_STATUS',
    }),
  }

  public async run(): Promise<void> {
    const {flags} = await this.parse(Logs)

    const apiKey = flags['client-id'] || flags['api-key']

    await checkFolderIsValidApp(flags.path)
    const logOptions = {
      apiKey,
      directory: flags.path,
      storeFqdn: flags.store,
      source: flags.source,
      status: flags.status,
      configName: flags.config,
      reset: flags.reset,
    }

    await logs(logOptions)
  }
}
