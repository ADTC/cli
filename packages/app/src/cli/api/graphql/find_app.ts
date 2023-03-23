import {gql} from 'graphql-request'

export const FindAppQuery = gql`
  query FindApp($apiKey: String!) {
    app(apiKey: $apiKey) {
      id
      title
      apiKey
      organizationId
      apiSecretKeys {
        secret
      }
      appType
      grantedScopes
      applicationUrl
      redirectUrlWhitelist
      webhookApiVersion
      gdprWebhooks {
        customerDeletionUrl
        customerDataRequestUrl
        shopDeletionUrl
      }
      embedded
      posEmbedded
      preferencesUrl
      appProxy {
        url
        subPath
        subPathPrefix
      }
    }
  }
`

export interface FindAppQuerySchema {
  app: {
    id: string
    title: string
    apiKey: string
    organizationId: string
    apiSecretKeys: {
      secret: string
    }[]
    appType: string
    grantedScopes: string[]
    applicationUrl: string
    redirectUrlWhitelist: string[]
    webhookApiVersion?: string
    gdprWebhooks?: {
      customerDeletionUrl?: string
      customerDataRequestUrl?: string
      shopDeletionUrl?: string
    }
    embedded: boolean
    posEmbedded: boolean
    preferencesUrl?: string
    appProxy?: {
      url: string
      subPath: string
      subPathPrefix: string
    }
  }
}
