import {DetailsFunctionRunLogEvent} from './types.js'

export function parseFunctionRunPayload(payload: string): DetailsFunctionRunLogEvent {
  const parsedPayload = JSON.parse(payload)
  return {
    input: parsedPayload.input,
    inputBytes: parsedPayload.input_bytes,
    output: parsedPayload.output,
    outputBytes: parsedPayload.output_bytes,
    logs: parsedPayload.logs,
    invocationId: parsedPayload.invocation_id,
    functionId: parsedPayload.function_id,
    fuelConsumed: parsedPayload.fuel_consumed,
    errorMessage: parsedPayload.error_message,
    errorType: parsedPayload.error_type,
  }
}

export function currentTime() {
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

export function addLeadingZero(number: number, length = 2) {
  return number.toString().padStart(length, '0')
}

export function prettyPrintJsonIfPossible(jsonString: unknown) {
  try {
    const jsonObject = JSON.parse(jsonString as string)
    return JSON.stringify(jsonObject, null, 2)
  } catch (error) {
    return jsonString
    throw new Error(`Failed to parse JSON: ${error}`)
  }
}