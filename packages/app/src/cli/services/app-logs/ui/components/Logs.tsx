import {subscribeProcess, SubscribeOptions, PollOptions, LogsProcess} from '../../processes/polling-app-logs.js'
import React, {FunctionComponent, useRef, useState, useEffect} from 'react'

import {Static, Box, Text} from '@shopify/cli-kit/node/ink'

export interface LogsProps {
  logsProcess: LogsProcess
  subscribeOptions: SubscribeOptions
  pollOptions: PollOptions
}

interface DetailsFunctionRunLogEvent {
  input: string
  inputBytes: number
  invocationId: string
  output: string
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: string
  errorMessage: string | null
  errorType: string | null
  status: string
  source: string
  eventType?: string
}

const POLLING_INTERVAL_MS = 450
const POLLING_ERROR_RETRY_INTERVAL_MS = 5 * 1000
const POLLING_THROTTLE_RETRY_INTERVAL_MS = 60 * 1000
const ONE_MILLION = 1000000

const Logs: FunctionComponent<LogsProps> = ({
  logsProcess,
  pollOptions: {cursor = '', jwtToken, filters},
  subscribeOptions: {developerPlatformClient, storeId, apiKey},
}) => {
  const pollingInterval = useRef<NodeJS.Timeout>()
  const currentIntervalRef = useRef<number>(POLLING_INTERVAL_MS)
  const [logs, setLogs] = useState<DetailsFunctionRunLogEvent[]>([])
  const [errorsState, setErrorsState] = useState<string[]>([])
  const [jwtTokenState, setJwtTokenState] = useState<string | null>(jwtToken)

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
        setJwtTokenState(jwtToken.jwtToken)
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
          setErrorsState([...errors, 'Resubscribing to logs.'])
        } else {
          currentIntervalRef.current = POLLING_ERROR_RETRY_INTERVAL_MS
          setErrorsState([...errors, `Retrying in ${POLLING_ERROR_RETRY_INTERVAL_MS / 1000} seconds.`])
        }
      }

      if (newCursor) {
        setErrorsState([])
        currentIntervalRef.current = POLLING_INTERVAL_MS
      }

      if (appLogs) {
        for (const log of appLogs) {
          const payload = JSON.parse(log.payload)
          const fuel = (payload.fuel_consumed / ONE_MILLION).toFixed(4)
          const logEvent: DetailsFunctionRunLogEvent = {
            input: payload.input,
            inputBytes: payload.input_bytes,
            output: payload.output,
            outputBytes: payload.output_bytes,
            logs: payload.logs,
            invocationId: payload.invocation_id,
            functionId: payload.function_id,
            fuelConsumed: fuel,
            errorMessage: payload.error_message,
            errorType: payload.error_type,
            status: log.status,
            source: log.source,
            eventType: log.event_type,
          }
          setLogs((logs) => [...logs, logEvent])
        }
      }
      pollingInterval.current = setTimeout(() => pollLogs(newCursor || currentCursor), currentIntervalRef.current)
    } catch (error) {
      setErrorsState(['There was an issue polling for logs. Please try again.'])
      throw error
    }
  }

  useEffect(() => {
    pollLogs(cursor)

    return () => {
      if (pollingInterval.current) {
        clearTimeout(pollingInterval.current)
      }
    }
  }, [cursor, jwtToken])

  return (
    <>
      <Static items={logs}>
        {(log: DetailsFunctionRunLogEvent, index: number) => (
          <Box flexDirection="column" key={index}>
            {/* update: use invocationId after https://github.com/Shopify/shopify-functions/issues/235 */}
            <Box flexDirection="row" gap={0.5}>
              <Text color="green">{currentTime()} </Text>
              <Text color="blueBright">{`${log.source}`}</Text>
              <Text color={log.status === 'Success' ? 'green' : 'red'}>{`${log.status}`}</Text>
              <Text> {`${log.functionId}`}</Text>
              <Text>in {log.fuelConsumed} M instructions</Text>
            </Box>
            <Text>{log.logs}</Text>
            <Text>Input ({log.inputBytes} bytes):</Text>
            <Text>{prettyPrintJson(log.input)}</Text>
          </Box>
        )}
      </Static>
      {/* <Box>{errorsState.length === 0 && <Text color="blueBright">Polling for app logs</Text>}</Box> */}
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

function currentTime() {
  const currentDateTime = new Date()
  const year = currentDateTime.getFullYear()
  const month = addLeadingZero(currentDateTime.getMonth() + 1)
  const day = addLeadingZero(currentDateTime.getDate())
  const hours = addLeadingZero(currentDateTime.getHours())
  const minutes = addLeadingZero(currentDateTime.getMinutes())
  const seconds = addLeadingZero(currentDateTime.getSeconds())
  const milliseconds = addLeadingZero(currentDateTime.getMilliseconds(), 3)

  return `${year}-${month}-${day} ${hours}:${minutes}:${seconds}.${milliseconds}`
}

function addLeadingZero(number: number, length = 2) {
  return number.toString().padStart(length, '0')
}

function prettyPrintJson(jsonString: string) {
  try {
    const jsonObject = JSON.parse(jsonString)
    return JSON.stringify(jsonObject, null, 2)
  } catch (error) {
    throw new Error(`Failed to parse JSON: ${error}`)
  }
}
