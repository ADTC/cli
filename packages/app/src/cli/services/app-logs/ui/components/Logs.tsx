import {AppEventData} from '../../../../services/logs.js'
import React, {FunctionComponent, useRef, useState, useEffect} from 'react'

import {Static, Box, Text} from '@shopify/cli-kit/node/ink'

export interface LogsProps {
  logsProcess: ({jwtToken, cursor}: {jwtToken: string; cursor?: string | undefined}) => Promise<{
    cursor?: string | undefined
    errors?: string[] | undefined
    appLogs?: AppEventData[] | undefined
  }>
  cursor: string
  jwtToken: string
}

interface DetailsFunctionRunLogEvent {
  input: string
  inputBytes: number
  invocationId: string
  output: string
  outputBytes: number
  logs: string
  functionId: string
  fuelConsumed: number
  errorMessage: string | null
  errorType: string | null
  status: string
  source: string
  eventType?: string
}

const POLLING_INTERVAL_MS = 450
const POLLING_BACKOFF_INTERVAL_MS = 10000
const ONE_MILLION = 1000000

const Logs: FunctionComponent<LogsProps> = ({logsProcess, cursor, jwtToken}) => {
  const pollingInterval = useRef<NodeJS.Timeout>()
  const [logs, setLogs] = useState<DetailsFunctionRunLogEvent[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [status, setStatus] = useState<string>('')

  const pollLogs = async (currentCursor: string) => {
    try {
      const {cursor: newCursor, errors, appLogs} = await logsProcess({jwtToken, cursor: currentCursor})
      if (errors) {
        setErrors(errors)
        setStatus('error')
        return
      }
      if (appLogs) {
        for (const log of appLogs) {
          const payload = JSON.parse(log.payload)
          const logEvent: DetailsFunctionRunLogEvent = {
            input: payload.input,
            inputBytes: payload.input_bytes,
            output: payload.output,
            outputBytes: payload.output_bytes,
            logs: payload.logs,
            invocationId: payload.invocation_id,
            functionId: payload.function_id,
            fuelConsumed: payload.fuel_consumed,
            errorMessage: payload.error_message,
            errorType: payload.error_type,
            status: log.status,
            source: log.source,
            eventType: log.event_type,
          }
          setLogs((logs) => [...logs, logEvent])
        }
        // for (const log of appLogs) {
        //   setLogs((logs) => [...logs, log])
        // }
      }
      setStatus('success')
      pollingInterval.current = setTimeout(() => pollLogs(newCursor || currentCursor), POLLING_INTERVAL_MS)
    } catch (error) {
      setErrors(['ERROR'])
      setStatus('error')
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
              <Text>in {log.fuelConsumed}M instructions</Text>
            </Box>
            <Text>{log.logs}</Text>
            <Text>Input ({log.inputBytes} bytes):</Text>
            <Text>{prettyPrintJson(log.input)}</Text>
          </Box>
        )}
      </Static>
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
