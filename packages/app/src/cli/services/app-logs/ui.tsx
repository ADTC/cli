import {LogsProps, Logs} from './ui/components/Logs.js'
import React from 'react'
import {render} from '@shopify/cli-kit/node/ui'

export async function renderLogs({
  logsProcess,
  cursor,
  jwtToken,
  developerPlatformClient,
  storeId,
  apiKey,
  filters,
}: LogsProps) {
  return render(
    <Logs
      logsProcess={logsProcess}
      cursor={cursor}
      jwtToken={jwtToken}
      developerPlatformClient={developerPlatformClient}
      apiKey={apiKey}
      storeId={storeId}
      filters={filters}
    />,
  )
}
