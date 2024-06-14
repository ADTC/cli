import {subscribeProcess, pollProcess} from './polling-app-logs.js'
import {testDeveloperPlatformClient} from '../../../models/app/app.test-data.js'
import {DeveloperPlatformClient} from '../../../utilities/developer-platform-client.js'
import {describe, expect, test, vi, beforeEach, Mock} from 'vitest'
import {outputDebug, outputWarn} from '@shopify/cli-kit/node/output'
import {partnersFqdn} from '@shopify/cli-kit/node/context/fqdn'
import {AbortError} from '@shopify/cli-kit/node/error'
import {fetch} from '@shopify/cli-kit/node/http'

vi.mock('@shopify/cli-kit/node/output')
vi.mock('@shopify/cli-kit/node/context/fqdn')
vi.mock('@shopify/cli-kit/node/http')

const FQDN = await partnersFqdn()
const MOCK_URL = '/app_logs/poll?cursor=mockedCursor'
const MOCKED_JWT_TOKEN = 'mockedJwtToken'
const MOCKED_API_KEY = 'mockedApiKey'
const MOCKED_STORE_ID = 'mockedStoreId'
const MOCKED_ERRORS = ['error1', 'error2']
const MOCKED_APP_LOGS = [{log: 'log1'}, {log: 'log2'}]
const MOCKED_CURSOR = 'mockedCursor'

const LOGS = '1\\n2\\n3\\n4\\n'
const FUNCTION_ERROR = 'function_error'
const FUNCTION_RUN = 'function_run'

const INPUT = {
  cart: {
    lines: [
      {
        quantity: 3,
        merchandise: {
          __typename: 'ProductVariant',
          id: 'gid:\\/\\/shopify\\/ProductVariant\\/2',
        },
      },
    ],
  },
}
const OUTPUT = {
  discountApplicationStrategy: 'FIRST',
  discounts: [
    {
      message: '10% off',
      value: {
        percentage: {
          value: 10,
        },
      },
      targets: [
        {
          productVariant: {
            id: 'gid://shopify/ProductVariant/2',
          },
        },
      ],
    },
  ],
}
const SOURCE = 'my-function'
const FUNCTION_PAYLOAD = {
  input: JSON.stringify(INPUT),
  input_bytes: 123,
  output: JSON.stringify(OUTPUT),
  output_bytes: 182,
  function_id: 'e57b4d31-2038-49ff-a0a1-1eea532414f7',
  logs: LOGS,
  fuel_consumed: 512436,
}
const FAILURE_PAYLOAD = {
  input: JSON.stringify(INPUT),
  input_bytes: 123,
  output: JSON.stringify(OUTPUT),
  output_bytes: 182,
  function_id: 'e57b4d31-2038-49ff-a0a1-1eea532414f7',
  logs: LOGS,
  error_type: FUNCTION_ERROR,
}
const OTHER_PAYLOAD = {some: 'arbitrary payload'}
const RETURNED_CURSOR = '2024-05-23T19:17:02.321773Z'
const RESPONSE_DATA_SUCCESS = {
  app_logs: [
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(FUNCTION_PAYLOAD),
      log_type: FUNCTION_RUN,
      cursor: RETURNED_CURSOR,
      status: 'success',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(FAILURE_PAYLOAD),
      log_type: FUNCTION_RUN,
      cursor: RETURNED_CURSOR,
      status: 'failure',
      source: SOURCE,
      source_namespace: 'extensions',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
    {
      shop_id: 1,
      api_client_id: 1830457,
      payload: JSON.stringify(OTHER_PAYLOAD),
      log_type: 'some arbitrary event type',
      cursor: RETURNED_CURSOR,
      status: 'failure',
      log_timestamp: '2024-05-23T19:17:00.240053Z',
    },
  ],
  cursor: RETURNED_CURSOR,
}

const RESPONSE_DATA_401 = {
  errors: ['401: Unauthorized'],
}

describe('subscribeProcess', () => {
  let subscribeToAppLogs: Mock<any, any>
  let developerPlatformClient: DeveloperPlatformClient

  beforeEach(() => {
    vi.mocked(partnersFqdn).mockResolvedValue(FQDN)
    subscribeToAppLogs = vi.fn()
    developerPlatformClient = testDeveloperPlatformClient({subscribeToAppLogs})
  })

  test('successful subscription', async () => {
    // Given
    subscribeToAppLogs.mockResolvedValue({
      appLogsSubscribe: {
        jwtToken: MOCKED_JWT_TOKEN,
        success: true,
        errors: [],
      },
    })

    // When
    const jwtToken = await subscribeProcess({
      storeId: MOCKED_STORE_ID,
      apiKey: MOCKED_API_KEY,
      developerPlatformClient,
    })

    // Then
    expect(jwtToken).toBe(MOCKED_JWT_TOKEN)
    expect(outputDebug).toHaveBeenCalledWith(`Token: ${MOCKED_JWT_TOKEN}\n`)
    expect(outputDebug).toHaveBeenCalledWith(`API Key: ${MOCKED_API_KEY}\n`)
    expect(outputDebug).toHaveBeenCalledWith(`Subscribed to App Events for shop ID(s) ${MOCKED_STORE_ID}`)
    expect(outputDebug).toHaveBeenCalledWith(`Success: true\n`)
  })

  test('subscription with errors', async () => {
    // Given
    subscribeToAppLogs.mockResolvedValue({
      appLogsSubscribe: {
        jwtToken: '',
        success: false,
        errors: MOCKED_ERRORS,
      },
    })

    // When
    await expect(
      subscribeProcess({
        storeId: MOCKED_STORE_ID,
        apiKey: MOCKED_API_KEY,
        developerPlatformClient,
      }),
    ).rejects.toThrow(AbortError)

    // Then
    expect(outputWarn).toHaveBeenCalledWith(`Errors subscribing to app logs: ${MOCKED_ERRORS.join(', ')}`)
    expect(outputWarn).toHaveBeenCalledWith('App log streaming is not available in this `log` session.')
  })
})

describe('pollProcess', () => {
  beforeEach(() => {
    vi.mocked(partnersFqdn).mockResolvedValue(FQDN)
  })

  test('successful poll', async () => {
    // Given
    const mockedFetch = vi.fn().mockResolvedValueOnce(Response.json(RESPONSE_DATA_SUCCESS))
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    const result = await pollProcess({
      jwtToken: MOCKED_JWT_TOKEN,
      cursor: MOCKED_CURSOR,
      filters: {},
    })

    // Then
    expect(fetch).toHaveBeenCalledWith(`https://${FQDN}${MOCK_URL}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MOCKED_JWT_TOKEN}`,
      },
    })

    expect(result).toEqual({
      cursor: RETURNED_CURSOR,
      appLogs: RESPONSE_DATA_SUCCESS.app_logs,
    })
  })

  test('polling with 401 status', async () => {
    // Given
    const status = 401
    const statusText = 'Unauthorized'
    const mockedFetch = vi.fn().mockResolvedValueOnce(new Response('errorMessage', {status, statusText}))
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    const result = await pollProcess({
      jwtToken: MOCKED_JWT_TOKEN,
      cursor: MOCKED_CURSOR,
      filters: {},
    })

    // Then
    expect(fetch).toHaveBeenCalledWith(`https://${FQDN}${MOCK_URL}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MOCKED_JWT_TOKEN}`,
      },
    })

    expect(result).toEqual({
      errors: ['401: Unauthorized'],
    })
  })

  test('polling with 429 status', async () => {
    // Given
    const status = 429
    const statusText = 'Resubscribe'
    const mockedFetch = vi.fn().mockResolvedValueOnce(new Response('errorMessage', {status, statusText}))
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    const result = await pollProcess({
      jwtToken: MOCKED_JWT_TOKEN,
      cursor: MOCKED_CURSOR,
      filters: {},
    })

    // Then
    expect(fetch).toHaveBeenCalledWith(`https://${FQDN}${MOCK_URL}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MOCKED_JWT_TOKEN}`,
      },
    })

    expect(result).toEqual({
      errors: ['429: Resubscribe'],
    })
  })

  test('polling with other error status', async () => {
    // Given
    const status = 422
    const statusText = 'Internal Error'
    const mockedFetch = vi.fn().mockResolvedValueOnce(
      new Response('errorMessage', {
        status: 422,
        statusText: 'Unprocessable Entity',
      }),
    )
    vi.mocked(fetch).mockImplementation(mockedFetch)

    // When
    await expect(
      pollProcess({
        jwtToken: MOCKED_JWT_TOKEN,
        cursor: MOCKED_CURSOR,
        filters: {},
      }),
    ).rejects.toThrow(AbortError)

    // Then
    expect(fetch).toHaveBeenCalledWith(`https://${FQDN}${MOCK_URL}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${MOCKED_JWT_TOKEN}`,
      },
    })
  })
})
