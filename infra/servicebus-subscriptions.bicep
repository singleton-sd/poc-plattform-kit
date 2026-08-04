@description('Existing Service Bus namespace name')
param serviceBusNamespaceName string

resource serviceBusNamespace 'Microsoft.ServiceBus/namespaces@2022-10-01-preview' existing = {
  name: serviceBusNamespaceName
}

// Publishing topics (pillars that emit domain events)
resource tenantTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'tenant.events'
}

resource ssoTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'single-sign-on.events'
}

resource permissionsTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'permissions.events'
}

resource subscriptionsTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'subscriptions.events'
}

resource contactTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'contact.events'
}

resource notificationsTopic 'Microsoft.ServiceBus/namespaces/topics@2022-10-01-preview' existing = {
  parent: serviceBusNamespace
  name: 'notifications.events'
}

// Domain event consumers (incl. Notifications for outbound triggers)
var domainConsumers = [
  'audit'
  'reporting'
  'support'
  'notifications'
]

// Trail / projection consumers on Notifications' own events
var notificationsTrailConsumers = [
  'audit'
  'reporting'
  'support'
]

resource tenantSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in domainConsumers: {
    parent: tenantTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

resource ssoSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in domainConsumers: {
    parent: ssoTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

resource permissionsSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in domainConsumers: {
    parent: permissionsTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

resource subscriptionsSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in domainConsumers: {
    parent: subscriptionsTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

resource contactSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in domainConsumers: {
    parent: contactTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

resource notificationsTrailSubs 'Microsoft.ServiceBus/namespaces/topics/subscriptions@2022-10-01-preview' = [
  for consumer in notificationsTrailConsumers: {
    parent: notificationsTopic
    name: consumer
    properties: {
      deadLetteringOnMessageExpiration: true
      maxDeliveryCount: 10
      lockDuration: 'PT1M'
    }
  }
]

output createdSubscriptionCount int = (length(domainConsumers) * 5) + length(notificationsTrailConsumers)
