import {reconcileAndPollThemeEditorChanges} from './remote-theme-watcher.js'
import {DevServerContext} from './types.js'
import {uploadTheme} from '../theme-uploader.js'
import {Theme} from '@shopify/cli-kit/node/themes/types'

export async function setupDevServer(theme: Theme, ctx: DevServerContext, onReady: () => void) {
  await ensureThemeEnvironmentSetup(theme, ctx)
  await startDevelopmentServer(theme, ctx)

  onReady()
}

async function ensureThemeEnvironmentSetup(theme: Theme, ctx: DevServerContext) {
  if (ctx.options?.themeEditorSync) {
    await reconcileAndPollThemeEditorChanges(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem)
  }

  await uploadTheme(theme, ctx.session, ctx.remoteChecksums, ctx.localThemeFileSystem, {})
}

async function startDevelopmentServer(_theme: Theme, _ctx: DevServerContext) {}
