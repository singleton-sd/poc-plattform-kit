// poc-plattform-kit — cheapest-that-works PoC Azure resources
// Deploy: ./infra/deploy.sh
// Cost: Free/Basic/Standard-min only (see SETUP.md).
// Secrets: Key Vault only. App config: Azure App Configuration (+ KV refs).
// Pipelines: GitHub OIDC → Azure → KV/App Config. No secrets in GitHub Secrets.
// Existing resources keep legacy uniqueString names; new resources use CAF names.

@description('Azure region for most resources')
param location string = resourceGroup().location

@description('Static Web Apps region (Free SKU is region-limited; eastasia works for AU PoCs)')
param swaLocation string = 'eastasia'

@description('Legacy short prefix for already-deployed resources (do not change — renames recreate)')
@minLength(3)
@maxLength(20)
param namePrefix string = 'pocpk'

@description('CAF Key Vault name (org-app-resource-env-region), max 24 chars')
@minLength(3)
@maxLength(24)
param keyVaultName string = 'ssd-pocpk-kv-dev-ae'

@description('CAF App Configuration store name')
param appConfigName string = 'ssd-pocpk-appcs-dev-ae'

@description('App Configuration SKU — Free preferred for PoC')
@allowed(['Free', 'Standard'])
param appConfigSku string = 'Free'

@description('Object ID of deployer/user to grant Key Vault Administrator (empty skips role)')
param deployerObjectId string = ''

@description('Static Web Apps SKU')
@allowed(['Free', 'Standard'])
param staticWebAppSku string = 'Free'

@description('CAF marketing Static Web App name')
param marketingSwaName string = 'ssd-pocpk-mkt-dev-ae'

@description('Service Bus SKU (Standard required for topics; never Premium for PoC)')
@allowed(['Standard'])
param serviceBusSku string = 'Standard'

@description('CAF Log Analytics workspace name')
param logAnalyticsWorkspaceName string = 'ssd-pocpk-law-dev-ae'

@description('CAF Application Insights name')
param applicationInsightsName string = 'ssd-pocpk-appi-dev-ae'

@description('CAF action group name for error alerts')
param errorActionGroupName string = 'ssd-pocpk-ag-errors-dev-ae'

@description('Email for error alerts (empty skips action group receivers and alert rules)')
param alertEmail string = ''

// Built-in role definition IDs
var roleKeyVaultAdministrator = '00482a5a-887f-4fb3-b363-3b7fe8e74483'
var roleKeyVaultSecretsUser = '4633458b-17de-408a-b874-0445c86b69e6'

var uniqueSuffix = uniqueString(resourceGroup().id)
var swaName = '${namePrefix}-web-${uniqueSuffix}'
var serviceBusName = '${namePrefix}-sb-${uniqueSuffix}'
var deployAlerts = !empty(alertEmail)

// Aligns with packages/events topicForPillar(): `{pillar}.events`
var eventTopics = [
  'tenant.events'
  'single-sign-on.events'
  'permissions.events'
  'subscriptions.events'
  'contact.events'
  'support.events'
  'audit.events'
  'reporting.events'
  'notifications.events'
]

// Explicit send-notification commands from other pillars (competing consumers)
var jobQueues = [
  'notifications.send'
]

// Relational database: Neon PostgreSQL (not provisioned in this template).
// Human sets Key Vault secrets `database-url` (pooled) and `database-url-unpooled`
// (direct). Production Nest API on Container Apps resolves them via App Configuration
// + managed identity (see infra/container-apps-api-prod.bicep / #303).

resource logAnalyticsWorkspace 'Microsoft.OperationalInsights/workspaces@2022-10-01' = {
  name: logAnalyticsWorkspaceName
  location: location
  properties: {
    sku: {
      name: 'PerGB2018'
    }
    retentionInDays: 30
  }
}

resource applicationInsights 'Microsoft.Insights/components@2020-02-02' = {
  name: applicationInsightsName
  location: location
  kind: 'web'
  properties: {
    Application_Type: 'web'
    WorkspaceResourceId: logAnalyticsWorkspace.id
    IngestionMode: 'LogAnalytics'
    publicNetworkAccessForIngestion: 'Enabled'
    publicNetworkAccessForQuery: 'Enabled'
  }
}

resource errorActionGroup 'Microsoft.Insights/actionGroups@2023-01-01' = if (deployAlerts) {
  name: errorActionGroupName
  location: 'Global'
  properties: {
    groupShortName: 'pocpkerr'
    enabled: true
    emailReceivers: [
      {
        name: 'primary'
        emailAddress: alertEmail
        useCommonAlertSchema: true
      }
    ]
  }
}

resource exceptionAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (deployAlerts) {
  name: 'ssd-pocpk-alert-exceptions-dev-ae'
  location: location
  properties: {
    displayName: 'pocpk AppExceptions'
    description: 'Alert when Application Insights records any exceptions in a 15-minute window'
    enabled: true
    severity: 2
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: 'exceptions'
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 1
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        errorActionGroup.id
      ]
    }
  }
}

resource failedRequestAlert 'Microsoft.Insights/scheduledQueryRules@2023-12-01' = if (deployAlerts) {
  name: 'ssd-pocpk-alert-failed-requests-dev-ae'
  location: location
  properties: {
    displayName: 'pocpk failed AppRequests'
    description: 'Alert when Application Insights records 5+ failed requests in a 15-minute window'
    enabled: true
    severity: 3
    evaluationFrequency: 'PT5M'
    windowSize: 'PT15M'
    scopes: [
      applicationInsights.id
    ]
    criteria: {
      allOf: [
        {
          query: 'requests\n| where success == false'
          timeAggregation: 'Count'
          operator: 'GreaterThanOrEqual'
          threshold: 5
          failingPeriods: {
            numberOfEvaluationPeriods: 1
            minFailingPeriodsToAlert: 1
          }
        }
      ]
    }
    actions: {
      actionGroups: [
        errorActionGroup.id
      ]
    }
  }
}

resource staticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: swaName
  location: swaLocation
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

resource marketingStaticWebApp 'Microsoft.Web/staticSites@2022-09-01' = {
  name: marketingSwaName
  location: swaLocation
  sku: {
    name: staticWebAppSku
    tier: staticWebAppSku
  }
  properties: {
    allowConfigFileUpdates: true
    stagingEnvironmentPolicy: 'Enabled'
  }
}

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' = {
  name: serviceBusName
  location: location
  sku: {
    name: serviceBusSku
    tier: serviceBusSku
  }
  properties: {
    minimumTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource topics 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' = [
  for topicName in eventTopics: {
    parent: serviceBusNamespace
    name: topicName
    properties: {
      defaultMessageTimeToLive: 'P14D'
      enableBatchedOperations: true
      supportOrdering: true
    }
  }
]

resource queues 'Microsoft.ServiceBus/namespaces/queues@2022-10-01-preview' = [
  for queueName in jobQueues: {
    parent: serviceBusNamespace
    name: queueName
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
      defaultMessageTimeToLive: 'P14D'
    }
  }
]

// Consumer subscriptions on publishing pillars (Audit / Reporting / Support / Notifications)
module topicSubs 'servicebus-subscriptions.bicep' = {
  name: 'servicebus-subscriptions'
  params: {
    serviceBusNamespaceName: serviceBusNamespace.name
  }
  dependsOn: [
    topics
  ]
}

// CAF name for new resources; Standard SKU (no Premium HSM). Soft-delete 7d; no purge protection (PoC).
resource keyVault 'Microsoft.KeyVault/vaults@2023-07-01' = {
  name: keyVaultName
  location: location
  properties: {
    sku: {
      family: 'A'
      name: 'standard'
    }
    tenantId: tenant().tenantId
    enableRbacAuthorization: true
    enableSoftDelete: true
    softDeleteRetentionInDays: 7
    publicNetworkAccess: 'Enabled'
  }
}

resource kvAdminRole 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  name: guid(keyVault.id, deployerObjectId, roleKeyVaultAdministrator)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultAdministrator)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

// Nest API production MI (Container App) is granted KV + App Config roles in
// container-apps-api-prod.bicep — not here.

// CAF App Configuration — non-secret config + Key Vault references for secret values.
// Free SKU for PoC. Apps load via managed identity + App Configuration provider.
resource appConfig 'Microsoft.AppConfiguration/configurationStores@2024-05-01' = {
  name: appConfigName
  location: location
  sku: {
    name: appConfigSku
  }
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    publicNetworkAccess: 'Enabled'
    disableLocalAuth: false
  }
}

var roleAppConfigDataOwner = '5ae67dd6-50cb-40e7-96ff-dc2bfa4b606b'

resource kvAppConfigSecretsUser 'Microsoft.Authorization/roleAssignments@2022-04-01' = {
  name: guid(keyVault.id, appConfig.id, roleKeyVaultSecretsUser)
  scope: keyVault
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleKeyVaultSecretsUser)
    principalId: appConfig.identity.principalId
    principalType: 'ServicePrincipal'
  }
}

resource appConfigDeployerOwner 'Microsoft.Authorization/roleAssignments@2022-04-01' = if (!empty(deployerObjectId)) {
  name: guid(appConfig.id, deployerObjectId, roleAppConfigDataOwner)
  scope: appConfig
  properties: {
    roleDefinitionId: subscriptionResourceId('Microsoft.Authorization/roleDefinitions', roleAppConfigDataOwner)
    principalId: deployerObjectId
    principalType: 'User'
  }
}

output resourceGroupName string = resourceGroup().name
output location string = location
output swaLocation string = swaLocation
output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output marketingStaticWebAppName string = marketingStaticWebApp.name
output marketingStaticWebAppHostname string = marketingStaticWebApp.properties.defaultHostname
output serviceBusNamespaceName string = serviceBusNamespace.name
output serviceBusTopics array = eventTopics
output subscriptionModuleName string = topicSubs.name
output keyVaultName string = keyVault.name
output keyVaultUri string = keyVault.properties.vaultUri
output appConfigName string = appConfig.name
output appConfigEndpoint string = appConfig.properties.endpoint
output appConfigPrincipalId string = appConfig.identity.principalId
output logAnalyticsWorkspaceName string = logAnalyticsWorkspace.name
output logAnalyticsWorkspaceId string = logAnalyticsWorkspace.id
output applicationInsightsName string = applicationInsights.name
output applicationInsightsId string = applicationInsights.id
output apiContainerAppNameHint string = 'ssd-pocpk-aca-api-dev-ae'