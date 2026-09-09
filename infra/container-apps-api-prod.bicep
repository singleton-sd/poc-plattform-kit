// Production Nest API — Azure Container Apps Consumption (persistent).
// Deploy: ./infra/deploy-aca-api.sh
// Requires existing CAE + ACR from container-apps-preview.bicep (do not create a second env).
// CAF: ssd-pocpk-aca-api-dev-ae on ssd-pocpk-cae-dev-ae.
// Cost: Consumption 0.25 vCPU / 0.5Gi / minReplicas 0 (scale to zero) / maxReplicas 2.
// Setting minReplicas = 1 would intentionally keep a warm replica (always-on cost).

@description('Azure region')
param location string = resourceGroup().location

@description('Existing Container Apps Environment name')
param containerAppsEnvironmentName string = 'ssd-pocpk-cae-dev-ae'

@description('Production Container App name (CAF)')
param containerAppName string = 'ssd-pocpk-aca-api-dev-ae'

@description('Existing ACR name (alphanumeric only)')
param acrName string = 'ssdpocpkacrdevae'

@description('CAF Key Vault name')
param keyVaultName string = 'ssd-pocpk-kv-dev-ae'

@description('CAF App Configuration store name')
param appConfigName string = 'ssd-pocpk-appcs-dev-ae'

@description('CAF Application Insights name')
param applicationInsightsName string = 'ssd-pocpk-appi-dev-ae'

@description('Legacy Service Bus namespace name (AZURE_SERVICEBUS_NAMESPACE)')
param serviceBusNamespaceName string = 'pocpk-sb-si5fhs6dvxiha'

@description('Full container image reference (registry/repo:tag). Prefer commit SHA tags, not latest-only.')
param apiImage string

@description('Nest listen / ingress target port')
param targetPort int = 3001

@description('Minimum replicas — keep 0 for scale-to-zero PoC cost; 1 = always-on compute')
@minValue(0)
@maxValue(2)
param minReplicas int = 0

@description('Maximum replicas')
@minValue(1)
@maxValue(5)
param maxReplicas int = 2

@secure()
@description('ACR admin password (from Key Vault acr-admin-password; never commit)')
param acrAdminPassword string

var tags = {
  project: 'poc-plattform-kit'
  environment: 'dev'
  purpose: 'api-production'
}

var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'
var roleAppConfigDataReader = '516239f1-63e1-4d78-a4de-a74fb236a071'

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: containerAppsEnvironmentName
}

resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' existing = {
  name: acrName
}

resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' existing = {
  name: keyVaultName
}

resource appConfig 'Microsoft.AppConfiguration/configurationStores@2024-05-01' existing = {
  name: appConfigName
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' existing = {
  name: applicationInsightsName
}

resource apiApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: containerAppName
  location: location
  tags: tags
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    managedEnvironmentId: containerAppsEnvironment.id
    workloadProfileName: 'Consumption'
    configuration: {
      activeRevisionsMode: 'Single'
      ingress: {
        external: true
        targetPort: targetPort
        allowInsecure: false
        transport: 'auto'
      }
      secrets: [
        {
          name: 'acr-password'
          value: acrAdminPassword
        }
      ]
      registries: [
        {
          server: acr.properties.loginServer
          username: acr.listCredentials().username
          passwordSecretRef: 'acr-password'
        }
      ]
    }
    template: {
      containers: [
        {
          name: 'api'
          image: apiImage
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          // Do NOT set DATABASE_URL here — App Configuration + MI resolves
          // secret:database-url (Neon). Preview apps override DATABASE_URL to SQLite.
          env: [
            {
              name: 'PORT'
              value: string(targetPort)
            }
            {
              name: 'NODE_ENV'
              value: 'production'
            }
            {
              name: 'AZURE_APPCONFIGURATION_ENDPOINT'
              value: appConfig.properties.endpoint
            }
            {
              name: 'AZURE_SERVICEBUS_NAMESPACE'
              value: serviceBusNamespaceName
            }
            {
              name: 'APPLICATIONINSIGHTS_CONNECTION_STRING'
              value: applicationInsights.properties.ConnectionString
            }
            {
              name: 'CORS_ORIGINS'
              value: 'https://app.plattform-kit.poc.singletonsd.com,https://plattform-kit.poc.singletonsd.com,https://kind-rock-0f409fe00*.azurestaticapps.net,https://purple-field-05048bf00*.azurestaticapps.net'
            }
            {
              name: 'NEXT_PUBLIC_API_BASE_URL'
              value: 'https://api.plattform-kit.poc.singletonsd.com'
            }
          ]
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/health'
                port: targetPort
              }
              initialDelaySeconds: 15
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/health'
                port: targetPort
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
        }
      ]
      scale: {
        minReplicas: minReplicas
        maxReplicas: maxReplicas
      }
    }
  }
}

resource kvApiSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, apiApp.id, roleKeyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appConfigApiDataReader 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(appConfig.id, apiApp.id, roleAppConfigDataReader)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAppConfigDataReader)
    principalId: apiApp.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

output containerAppName string = apiApp.name
output containerAppFqdn string = apiApp.properties.configuration.ingress.fqdn
output containerAppPrincipalId string = apiApp.identity.principalId
output containerAppUrl string = 'https://${apiApp.properties.configuration.ingress.fqdn}'
output minReplicas int = minReplicas
output maxReplicas int = maxReplicas
