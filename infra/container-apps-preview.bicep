// API PR previews — Azure Container Apps Consumption + ACR Basic (cheapest that works).
// Deploy: powershell -File ./infra/deploy-aca-preview.ps1
// Ephemeral per-PR apps are created/deleted by .github/workflows/preview-api.yml (not here).
// ACR admin creds are upserted to Key Vault by the deploy script (never git).

@description('Azure region')
param location string = resourceGroup().location

@description('CAF Log Analytics name (required by Container Apps Environment)')
param logAnalyticsName string = 'ssd-pocpk-law-dev-ae'

@description('CAF Container Apps Environment name')
param containerAppsEnvironmentName string = 'ssd-pocpk-cae-dev-ae'

@description('Optional base Container App (placeholder until Nest image exists)')
param baseContainerAppName string = 'ssd-pocpk-aca-api-dev-ae'

@description('ACR name — alphanumeric only (Azure rule); CAF without hyphens')
@minLength(5)
@maxLength(50)
param acrName string = 'ssdpocpkacrdevae'

@description('Create optional base Container App with quickstart image')
param deployBaseContainerApp bool = false

@description('Target container port for Nest API image (quickstart uses 80)')
param nestTargetPort int = 3001

var tags = {
  project: 'poc-plattform-kit'
  environment: 'dev'
  purpose: 'api-pr-previews'
}

// ACR Basic — cheapest SKU that supports private images. No anonymous pull.
resource acr 'Microsoft.ContainerRegistry/registries@2025-04-01' = {
  name: acrName
  location: location
  tags: tags
  sku: {
    name: 'Basic'
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    adminUserEnabled: true
    anonymousPullEnabled: false
    publicNetworkAccess: 'Enabled'
    zoneRedundancy: 'Disabled'
  }
}

resource logAnalytics 'Microsoft.OperationalInsights/workspaces@2023-09-01' = {
  name: logAnalyticsName
  location: location
  tags: tags
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' = {
  name: containerAppsEnvironmentName
  location: location
  tags: tags
  properties: {
    zoneRedundant: false
    appLogsConfiguration: {
      destination: 'log-analytics'
      logAnalyticsConfiguration: {
        customerId: logAnalytics.properties.customerId
        sharedKey: logAnalytics.listKeys().primarySharedKey
      }
    }
    // Consumption workload profile — scale-to-zero, no dedicated nodes
    workloadProfiles: [
      {
        name: 'Consumption'
        workloadProfileType: 'Consumption'
      }
    ]
  }
}

// Optional placeholder. PR workflow creates ssd-pocpk-aca-pr-<n>-ae ephemerally.
resource baseContainerApp 'Microsoft.App/containerApps@2025-01-01' = if (deployBaseContainerApp) {
  name: baseContainerAppName
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
        targetPort: 80
        allowInsecure: false
        transport: 'auto'
      }
    }
    template: {
      containers: [
        {
          name: 'api'
          image: 'mcr.microsoft.com/k8se/quickstart:latest'
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      scale: {
        minReplicas: 0
        maxReplicas: 1
      }
    }
  }
}

output acrName string = acr.name
output acrLoginServer string = acr.properties.loginServer
output containerAppsEnvironmentName string = containerAppsEnvironment.name
output containerAppsEnvironmentId string = containerAppsEnvironment.id
output containerAppsEnvironmentDefaultDomain string = containerAppsEnvironment.properties.defaultDomain
output logAnalyticsName string = logAnalytics.name
output baseContainerAppName string = deployBaseContainerApp ? baseContainerApp!.name : ''
output baseContainerAppFqdn string = deployBaseContainerApp ? baseContainerApp!.properties.configuration.ingress.fqdn : ''
output nestTargetPort int = nestTargetPort
output ephemeralAppNamePattern string = 'ssd-pocpk-aca-pr-<n>-ae'
output keyVaultSecretNamesHint array = [
  'acr-admin-username'
  'acr-admin-password'
  'acr-login-server'
]
