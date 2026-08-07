// Decap CMS GitHub OAuth proxy — Azure Functions on existing Linux B1 plan.
// Y1 Linux Consumption is blocked in rg-poc-plattform-kit (already has Dedicated B1).
// Deploy: powershell ./scripts/deploy-decap-oauth.ps1
// Secrets: OAUTH_CLIENT_SECRET from Key Vault only (never GitHub Secrets).
// CAF: ssd-pocpk-decap-oauth-dev-ae

@description('Azure region')
param location string = resourceGroup().location

@description('Function App name (CAF)')
param functionAppName string = 'ssd-pocpk-decap-oauth-dev-ae'

@description('Storage account for Functions (3-24 lowercase alphanumeric)')
param storageAccountName string = 'ssdpocpkstdoauth'

@description('Existing Linux App Service Plan name (Dedicated B1 — shares API plan)')
param planName string = 'pocpk-plan'

@description('Existing Key Vault name')
param keyVaultName string = 'ssd-pocpk-kv-dev-ae'

@description('GitHub OAuth App client id (non-secret)')
param oauthClientId string

@description('Comma-separated Decap opener hostnames (no scheme)')
param origins string = 'plattform-kit.poc.singletonsd.com,localhost:4321'

@description('KV secret name for GitHub OAuth client secret')
param oauthClientSecretName string = 'github-decap-oauth-client-secret'

var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var redirectUrl = 'https://${functionAppName}.azurewebsites.net/callback'

resource storage 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
  }
}

resource plan 'Microsoft.Web/serverfarms@2023-12-01' existing = {
  name: planName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource functionApp 'Microsoft.Web/sites@2023-12-01' = {
  name: functionAppName
  location: location
  kind: 'functionapp,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: plan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'Node|24'
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'AzureWebJobsStorage'
          value: 'DefaultEndpointsProtocol=https;AccountName=${storage.name};EndpointSuffix=${environment().suffixes.storage};AccountKey=${storage.listKeys().keys[0].value}'
        }
        {
          name: 'FUNCTIONS_EXTENSION_VERSION'
          value: '~4'
        }
        {
          name: 'FUNCTIONS_WORKER_RUNTIME'
          value: 'node'
        }
        {
          name: 'AzureWebJobsFeatureFlags'
          value: 'EnableWorkerIndexing'
        }
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~24'
        }
        {
          name: 'OAUTH_CLIENT_ID'
          value: oauthClientId
        }
        {
          name: 'OAUTH_CLIENT_SECRET'
          value: '@Microsoft.KeyVault(SecretUri=${keyVault.properties.vaultUri}secrets/${oauthClientSecretName}/)'
        }
        {
          name: 'REDIRECT_URL'
          value: redirectUrl
        }
        {
          name: 'SCOPES'
          value: 'repo,user'
        }
        {
          name: 'ORIGINS'
          value: origins
        }
      ]
    }
  }
}

resource kvFunctionSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, functionApp.id, roleKeyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: functionApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output functionAppName string = functionApp.name
output functionAppHostname string = functionApp.properties.defaultHostName
output functionAppPrincipalId string = functionApp.identity.principalId
output redirectUrl string = redirectUrl
output baseUrl string = 'https://${functionApp.properties.defaultHostName}'
