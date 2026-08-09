// OpenFGA authZ engine — Azure Container Apps Consumption + Azure Files (SQLite beta).
// Deploy: powershell -File ./infra/deploy-openfga.ps1
// CAF: ssd-pocpk-openfga-dev-ae on existing CAE ssd-pocpk-cae-dev-ae.
// Datastore: SQLite on Azure Files (not container-local). Beta engine — single replica only.
// AuthN: OPENFGA_AUTHN_METHOD=oidc against Entra app api://ssd-pocpk-openfga (wired by deploy script).

@description('Azure region')
param location string = resourceGroup().location

@description('Existing Container Apps Environment name')
param containerAppsEnvironmentName string = 'ssd-pocpk-cae-dev-ae'

@description('OpenFGA Container App name (CAF)')
param openfgaAppName string = 'ssd-pocpk-openfga-dev-ae'

@description('Storage account for Azure Files SQLite share (3–24 lowercase alphanumeric)')
@minLength(3)
@maxLength(24)
param storageAccountName string = 'ssdpocpkstofga'

@description('Azure Files share name for the OpenFGA SQLite database')
param fileShareName string = 'openfga-data'

@description('CAE storage mount name referenced by the Container App volume')
param caeStorageName string = 'openfga-files'

@description('Pinned openfga/openfga image tag (include v prefix)')
param openfgaImageTag string = 'v1.18.3'

@description('OIDC issuer URL (Entra v2), e.g. https://login.microsoftonline.com/{tenant}/v2.0')
param oidcIssuer string

@description('OIDC issuer alias (Entra v1 sts), e.g. https://sts.windows.net/{tenant}/')
param oidcIssuerAlias string

@description('OIDC audience / App ID URI for the OpenFGA Entra app registration')
param openfgaAudience string = 'api://ssd-pocpk-openfga'

@description('HTTP target port for OpenFGA')
param targetPort int = 8080

var tags = {
  project: 'poc-plattform-kit'
  environment: 'dev'
  purpose: 'openfga-authz'
}

var openfgaImage = 'openfga/openfga:${openfgaImageTag}'
var datastoreUri = 'file:/data/openfga.db'

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: containerAppsEnvironmentName
}

resource storageAccount 'Microsoft.Storage/storageAccounts@2023-05-01' = {
  name: storageAccountName
  location: location
  tags: tags
  sku: {
    name: 'Standard_LRS'
  }
  kind: 'StorageV2'
  properties: {
    allowBlobPublicAccess: false
    minimumTlsVersion: 'TLS1_2'
    supportsHttpsTrafficOnly: true
    allowSharedKeyAccess: true // required for ACA Azure Files SMB mounts today
  }
}

resource fileServices 'Microsoft.Storage/storageAccounts/fileServices@2023-05-01' = {
  parent: storageAccount
  name: 'default'
}

resource fileShare 'Microsoft.Storage/storageAccounts/fileServices/shares@2023-05-01' = {
  parent: fileServices
  name: fileShareName
  properties: {
    shareQuota: 5 // GiB — SQLite PoC footprint is tiny
    accessTier: 'TransactionOptimized'
  }
}

resource caeStorage 'Microsoft.App/managedEnvironments/storages@2025-01-01' = {
  parent: containerAppsEnvironment
  name: caeStorageName
  properties: {
    azureFile: {
      accountName: storageAccount.name
      accountKey: storageAccount.listKeys().keys[0].value
      shareName: fileShare.name
      accessMode: 'ReadWrite'
    }
  }
}

resource openfgaApp 'Microsoft.App/containerApps@2025-01-01' = {
  name: openfgaAppName
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
    }
    template: {
      initContainers: [
        {
          name: 'migrate'
          image: openfgaImage
          args: [
            'migrate'
          ]
          env: [
            {
              name: 'OPENFGA_DATASTORE_ENGINE'
              value: 'sqlite'
            }
            {
              name: 'OPENFGA_DATASTORE_URI'
              value: datastoreUri
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
          volumeMounts: [
            {
              volumeName: 'openfga-data'
              mountPath: '/data'
            }
          ]
        }
      ]
      containers: [
        {
          name: 'openfga'
          image: openfgaImage
          args: [
            'run'
          ]
          env: [
            {
              name: 'OPENFGA_DATASTORE_ENGINE'
              value: 'sqlite'
            }
            {
              name: 'OPENFGA_DATASTORE_URI'
              value: datastoreUri
            }
            {
              name: 'OPENFGA_AUTHN_METHOD'
              value: 'oidc'
            }
            {
              name: 'OPENFGA_AUTHN_OIDC_ISSUER'
              value: oidcIssuer
            }
            {
              name: 'OPENFGA_AUTHN_OIDC_ISSUER_ALIASES'
              value: oidcIssuerAlias
            }
            {
              name: 'OPENFGA_AUTHN_OIDC_AUDIENCE'
              value: openfgaAudience
            }
            {
              name: 'OPENFGA_HTTP_ADDR'
              value: '0.0.0.0:${targetPort}'
            }
            {
              name: 'OPENFGA_PLAYGROUND_ENABLED'
              value: 'false'
            }
          ]
          resources: {
            cpu: json('0.5')
            memory: '1Gi'
          }
          probes: [
            {
              type: 'Liveness'
              httpGet: {
                path: '/healthz'
                port: targetPort
              }
              initialDelaySeconds: 10
              periodSeconds: 30
            }
            {
              type: 'Readiness'
              httpGet: {
                path: '/healthz'
                port: targetPort
              }
              initialDelaySeconds: 5
              periodSeconds: 10
            }
          ]
          volumeMounts: [
            {
              volumeName: 'openfga-data'
              mountPath: '/data'
            }
          ]
        }
      ]
      scale: {
        // SQLite + Azure Files SMB is single-writer; keep exactly one replica.
        minReplicas: 1
        maxReplicas: 1
      }
      volumes: [
        {
          name: 'openfga-data'
          storageType: 'AzureFile'
          storageName: caeStorage.name
        }
      ]
    }
  }
}

output openfgaAppName string = openfgaApp.name
output openfgaFqdn string = openfgaApp.properties.configuration.ingress.fqdn
output openfgaApiUrl string = 'https://${openfgaApp.properties.configuration.ingress.fqdn}'
output openfgaPrincipalId string = openfgaApp.identity.principalId
output storageAccountName string = storageAccount.name
output fileShareName string = fileShare.name
output caeStorageName string = caeStorage.name
output openfgaImage string = openfgaImage
output openfgaAudience string = openfgaAudience
output datastoreEngine string = 'sqlite'
output datastoreUri string = datastoreUri
