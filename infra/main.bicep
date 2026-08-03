// poc-plattform-kit — minimum viable Azure resources
// Deploy: pwsh ./infra/deploy.ps1
// Secrets: Azure Key Vault is the locked store (see infra/README.md).
// SQL admin password is a secure param only — never commit; upsert into Key Vault
// (pocpk-kv-*) and use KV references on App Service/SWA. Add Key Vault resource
// + RBAC in a follow-up; do not leave long-lived secrets only in GitHub Secrets.

@description('Azure region for most resources')
param location string = resourceGroup().location

@description('Static Web Apps region (Free SKU is region-limited; eastasia works for AU PoCs)')
param swaLocation string = 'eastasia'

@description('Short name prefix for resources (lowercase alphanumeric)')
@minLength(3)
@maxLength(20)
param namePrefix string = 'pocpk'

@description('SQL Server administrator login')
param sqlAdminLogin string = 'pocpkadmin'

@description('SQL Server administrator password (generated locally; never commit)')
@secure()
param sqlAdminPassword string

@description('App Service Plan SKU')
@allowed(['B1', 'B2', 'S1'])
param appServiceSku string = 'B1'

@description('Static Web Apps SKU')
@allowed(['Free', 'Standard'])
param staticWebAppSku string = 'Free'

@description('Service Bus SKU (Standard required for topics)')
@allowed(['Standard', 'Premium'])
param serviceBusSku string = 'Standard'

@description('Azure SQL database name')
param sqlDatabaseName string = 'pocpk'

var uniqueSuffix = uniqueString(resourceGroup().id)
var sqlServerName = '${namePrefix}-sql-${uniqueSuffix}'
var appPlanName = '${namePrefix}-plan'
var webAppName = '${namePrefix}-api-${uniqueSuffix}'
var swaName = '${namePrefix}-web-${uniqueSuffix}'
var serviceBusName = '${namePrefix}-sb-${uniqueSuffix}'

// Aligns with packages/events topicForPillar(): `{pillar}.events`
var eventTopics = [
  'tenant.events'
  'single-sign-on.events'
  'subscriptions.events'
  'contact.events'
  'support.events'
  'audit.events'
  'reporting.events'
]

resource sqlServer 'Microsoft.Sql/servers@2023-08-01-preview' = {
  name: sqlServerName
  location: location
  properties: {
    administratorLogin: sqlAdminLogin
    administratorLoginPassword: sqlAdminPassword
    version: '12.0'
    minimalTlsVersion: '1.2'
    publicNetworkAccess: 'Enabled'
  }
}

resource sqlFirewallAzure 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAzureServices'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '0.0.0.0'
  }
}

// PoC convenience — replace with your client IP before production use
resource sqlFirewallDev 'Microsoft.Sql/servers/firewallRules@2023-08-01-preview' = {
  parent: sqlServer
  name: 'AllowAllDevPoC'
  properties: {
    startIpAddress: '0.0.0.0'
    endIpAddress: '255.255.255.255'
  }
}

resource sqlDatabase 'Microsoft.Sql/servers/databases@2023-08-01-preview' = {
  parent: sqlServer
  name: sqlDatabaseName
  location: location
  sku: {
    name: 'Basic'
    tier: 'Basic'
    capacity: 5
  }
  properties: {
    collation: 'SQL_Latin1_General_CP1_CI_AS'
    maxSizeBytes: 2147483648
  }
}

resource appPlan 'Microsoft.Web/serverfarms@2023-12-01' = {
  name: appPlanName
  location: location
  sku: {
    name: appServiceSku
  }
  kind: 'linux'
  properties: {
    reserved: true
  }
}

resource webApp 'Microsoft.Web/sites@2023-12-01' = {
  name: webAppName
  location: location
  kind: 'app,linux'
  identity: {
    type: 'SystemAssigned'
  }
  properties: {
    serverFarmId: appPlan.id
    httpsOnly: true
    siteConfig: {
      linuxFxVersion: 'NODE|20-lts'
      alwaysOn: false
      ftpsState: 'Disabled'
      minTlsVersion: '1.2'
      appSettings: [
        {
          name: 'WEBSITE_NODE_DEFAULT_VERSION'
          value: '~20'
        }
        {
          name: 'SCM_DO_BUILD_DURING_DEPLOYMENT'
          value: 'true'
        }
        {
          name: 'AZURE_SERVICEBUS_NAMESPACE'
          value: serviceBusName
        }
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

// Consumer subscriptions on publishing pillars (Audit / Reporting / Support)
module topicSubs 'servicebus-subscriptions.bicep' = {
  name: 'servicebus-subscriptions'
  params: {
    serviceBusNamespaceName: serviceBusNamespace.name
  }
  dependsOn: [
    topics
  ]
}

output resourceGroupName string = resourceGroup().name
output location string = location
output swaLocation string = swaLocation
output sqlServerName string = sqlServer.name
output sqlServerFqdn string = sqlServer.properties.fullyQualifiedDomainName
output sqlDatabaseName string = sqlDatabase.name
output sqlAdminLogin string = sqlAdminLogin
output webAppName string = webApp.name
output webAppHostname string = webApp.properties.defaultHostName
output webAppPrincipalId string = webApp.identity.principalId
output staticWebAppName string = staticWebApp.name
output staticWebAppHostname string = staticWebApp.properties.defaultHostname
output serviceBusNamespaceName string = serviceBusNamespace.name
output serviceBusTopics array = eventTopics
output appServicePlanName string = appPlan.name
output subscriptionModuleName string = topicSubs.name
