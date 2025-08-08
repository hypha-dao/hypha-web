# Notifications package

A wrapper for [OneSignal web
SDK](https://documentation.onesignal.com/docs/web-sdk-reference).

## Installation

- Register to OneSignal and get app ID and API key;
- Download and add [OneSignal's service
  worker](https://documentation.onesignal.com/docs/onesignal-service-worker) to
  your application;
- Instantiate
  [NotificationSubscriber](./src/components/notifications-subscriber.tsx#L11)
  in the root layout and pass credentials to it.
