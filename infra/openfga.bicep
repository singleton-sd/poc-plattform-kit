// OpenFGA authZ engine — Azure Container Apps Consumption + Neon PostgreSQL datastore.
// Deploy: powershell -File ./infra/deploy-openfga.ps1
// CAF: ssd-pocpk-openfga-dev-ae on existing CAE ssd-pocpk-cae-dev-ae.
// Datastore: PostgreSQL on Neon (`openfga` database); connection strings from deploy script / Key Vault.
// AuthN: OPENFGA_AUTHN_METHOD=oidc against Entra app api://{tenant}/ssd-pocpk-openfga (wired by deploy script).

@description('Azure region')
param location string = resourceGroup().location

@description('Existing Container Apps Environment name')
param containerAppsEnvironmentName string = 'ssd-pocpk-cae-dev-ae'

@description('OpenFGA Container App name (CAF)')
param openfgaAppName string = 'ssd-pocpk-openfga-dev-ae'

@description('Pinned openfga/openfga image tag (include v prefix)')
param openfgaImageTag string = 'v1.18.3'

@description('OIDC issuer URL (Entra v2), e.g. https://login.microsoftonline.com/{tenant}/v2.0')
param oidcIssuer string

@description('OIDC issuer alias (Entra v1 sts), e.g. https://sts.windows.net/{tenant}/')
param oidcIssuerAlias string

@description('OIDC audience / App ID URI for the OpenFGA Entra app registration (tenant-scoped; bare api://ssd-pocpk-openfga is blocked by Entra verified-domain policy)')
param openfgaAudience string = 'api://9a0e57d7-e58e-4e8b-814d-037cd7d9015c/ssd-pocpk-openfga'

@description('HTTP target port for OpenFGA')
param targetPort int = 8080

@secure()
@description('Neon PostgreSQL connection string (direct / unpooled) for migrate init container')
param openfgaDatastoreUriMigrate string

@secure()
@description('Neon PostgreSQL connection string (pooled) for OpenFGA runtime')
param openfgaDatastoreUriRuntime string

var tags = {
  project: 'poc-plattform-kit'
  environment: 'dev'
  purpose: 'openfga-authz'
}

var openfgaImage = 'openfga/openfga:${openfgaImageTag}'
var datastoreEngine = 'postgres'

resource containerAppsEnvironment 'Microsoft.App/managedEnvironments@2025-01-01' existing = {
  name: containerAppsEnvironmentName
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
      secrets: [
        {
          name: 'openfga-datastore-uri-migrate'
          value: openfgaDatastoreUriMigrate
        }
        {
          name: 'openfga-datastore-uri-runtime'
          value: openfgaDatastoreUriRuntime
        }
      ]
    }
    template: {
      initContainers: [
        {
          name: 'migrate'
          image: openfgaImage
          args: [
            'migrate'
            '--datastore-engine'
            datastoreEngine
            '--timeout'
            '5m'
            '--verbose'
          ]
          env: [
            {
              name: 'OPENFGA_DATASTORE_ENGINE'
              value: datastoreEngine
            }
            {
              name: 'OPENFGA_DATASTORE_URI'
              secretRef: 'openfga-datastore-uri-migrate'
            }
          ]
          resources: {
            cpu: json('0.25')
            memory: '0.5Gi'
          }
        }
      ]
      containers: [
        {
          name: 'openfga'
          image: openfgaImage
          args: [
            'run'
            '--datastore-engine'
            datastoreEngine
          ]
          env: [
            {
              name: 'OPENFGA_DATASTORE_ENGINE'
              value: datastoreEngine
            }
            {
              name: 'OPENFGA_DATASTORE_URI'
              secretRef: 'openfga-datastore-uri-runtime'
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
            {
              name: 'OPENFGA_REQUEST_TIMEOUT'
              value: '30s'
            }
            {
              name: 'OPENFGA_HTTP_UPSTREAM_TIMEOUT'
              value: '30s'
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
        }
      ]
      scale: {
        minReplicas: 1
        maxReplicas: 1
      }
    }
  }
}

output openfgaAppName string = openfgaApp.name
output openfgaFqdn string = openfgaApp.properties.configuration.ingress.fqdn
output openfgaApiUrl string = 'https://${openfgaApp.properties.configuration.ingress.fqdn}'
output openfgaPrincipalId string = openfgaApp.identity.principalId
output openfgaImage string = openfgaImage
output openfgaAudience string = openfgaAudience
output datastoreEngine string = datastoreEngine
