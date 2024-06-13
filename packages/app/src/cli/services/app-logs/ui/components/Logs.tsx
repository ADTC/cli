import {subscribeProcess} from '../../processes/polling-app-logs.js'
import {SubscribeOptions, PollOptions, LogsProcess, FunctionRunLog} from '../../types.js'
import {parseFunctionRunPayload, currentTime, prettyPrintJsonIfPossible} from '../../helpers.js'
import {
  POLLING_INTERVAL_MS,
  POLLING_ERROR_RETRY_INTERVAL_MS,
  POLLING_THROTTLE_RETRY_INTERVAL_MS,
  ONE_MILLION,
} from '../../constants.js'
import React, {FunctionComponent, useRef, useState, useEffect} from 'react'

import {Static, Box, Text} from '@shopify/cli-kit/node/ink'

export interface LogsProps {
  logsProcess: LogsProcess
  subscribeOptions: SubscribeOptions
  pollOptions: PollOptions
}

interface AppLogPrefix {
  status: string
  source: string
  fuelConsumed: string
  functionId: string
}

interface ProcessOutout {
  prefix: AppLogPrefix
  appLog: FunctionRunLog
}

const Logs: FunctionComponent<LogsProps> = ({
  logsProcess,
  pollOptions: {cursor = '', jwtToken, filters},
  subscribeOptions: {developerPlatformClient, storeId, apiKey},
}) => {
  const pollingInterval = useRef<NodeJS.Timeout>()
  const currentIntervalRef = useRef<number>(POLLING_INTERVAL_MS)
  const [processOutputs, setProcessOutputs] = useState<ProcessOutout[]>([])
  const [errorsState, setErrorsState] = useState<string[]>([])
  const [jwtTokenState, setJwtTokenState] = useState<string | null>(jwtToken)

  useEffect(() => {
    const pollLogs = async (currentCursor: string) => {
      try {
        if (jwtTokenState === null) {
          const jwtToken = await subscribeProcess({
            developerPlatformClient,
            storeId,
            apiKey,
          })
          if (!jwtToken) {
            return
          }
          setJwtTokenState(jwtToken)
        }
        const {
          cursor: newCursor,
          errors,
          appLogs,
        } = await logsProcess({jwtToken: jwtTokenState || jwtToken, cursor: currentCursor, filters})
        if (errors) {
          if (errors.some((error) => error.includes('429'))) {
            currentIntervalRef.current = POLLING_THROTTLE_RETRY_INTERVAL_MS
            setErrorsState([...errors, `Retrying in ${POLLING_THROTTLE_RETRY_INTERVAL_MS / 1000} seconds.`])
          } else if (errors.some((error) => error.includes('401'))) {
            setJwtTokenState(null)
          } else {
            currentIntervalRef.current = POLLING_ERROR_RETRY_INTERVAL_MS
            setErrorsState([...errors, `Retrying in ${POLLING_ERROR_RETRY_INTERVAL_MS / 1000} seconds.`])
          }
        } else {
          setErrorsState([])
          currentIntervalRef.current = POLLING_INTERVAL_MS
        }

        if (appLogs) {
          for (const log of appLogs) {
            const appLog = parseFunctionRunPayload(log.payload)
            const fuel = (appLog.fuelConsumed / ONE_MILLION).toFixed(4)
            const prefix = {
              status: log.status === 'success' ? 'Success' : 'Failure',
              source: log.source,
              fuelConsumed: fuel,
              functionId: appLog.functionId,
            }
            setProcessOutputs((prev) => [
              ...prev,
              {
                prefix,
                appLog,
              },
            ])
          }
        }
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        pollingInterval.current = setTimeout(() => {
          return pollLogs(newCursor || currentCursor)
        }, currentIntervalRef.current)
      } catch (error) {
        setErrorsState(['There was an issue polling for logs. Please try again.'])
        throw error
      }
    }

    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    pollLogs(cursor)

    return () => {
      if (pollingInterval.current) {
        clearTimeout(pollingInterval.current)
      }
    }
  }, [cursor, jwtToken])

  return (
    <>
      <Static items={processOutputs}>
        {(
          {
            appLog,
            prefix,
          }: {
            appLog: FunctionRunLog
            prefix: AppLogPrefix
          },
          index: number,
        ) => (
          <Box flexDirection="column" key={index}>
            {/* update: use invocationId after https://github.com/Shopify/shopify-functions/issues/235 */}
            <Box flexDirection="row" gap={0.5}>
              <Text color="green">{currentTime()} </Text>
              <Text color="blueBright">{`${prefix.source}`}</Text>
              <Text color={prefix.status === 'Success' ? 'green' : 'red'}>{`${prefix.status}`}</Text>
              <Text> {`${prefix.functionId}`}</Text>
              <Text>in {prefix.fuelConsumed} M instructions</Text>
            </Box>
            <Text>{appLog.logs}</Text>
            <Text>Input ({appLog.inputBytes} bytes):</Text>
            <Text>{prettyPrintJsonIfPossible(appLog.input)}</Text>
            {appLog.output && (
              <>
                <Text>Output ({appLog.outputBytes} bytes):</Text>
                <Text>{prettyPrintJsonIfPossible(appLog.output)}</Text>
              </>
            )}
          </Box>
        )}
      </Static>
      <Box flexDirection="column">
        {errorsState.length > 0 &&
          errorsState.map((error, index) => (
            <Text key={index} color="red">
              {error}
            </Text>
          ))}
      </Box>
    </>
  )
}

export {Logs}
