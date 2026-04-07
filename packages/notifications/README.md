# Notifications package

> [!IMPORTANT]
> The server part of this package uses the **beta** version of OneSignal’s SDK.

A wrapper around the [OneSignal Web
SDK](https://documentation.onesignal.com/docs/web-sdk-reference).

## Installation

- Register with OneSignal and obtain your App ID and API key.
- Add the [OneSignal service
  worker](https://documentation.onesignal.com/docs/onesignal-service-worker) to
  your application (for this repo, it lives at
  `/onesignal/OneSignalSDKWorker.js` under `public`).
- Ensure responses for `/onesignal/OneSignalSDKWorker.js` include
  `Service-Worker-Allowed: /` so the worker can control the whole origin (see
  apps/web/next.config.js).
- Instantiate
  [NotificationSubscriber](./src/components/notifications-subscriber.tsx#L11)
  in your app’s root layout and pass the required credentials (e.g.,
  `NEXT_PUBLIC_ONESIGNAL_APP_ID`; the server uses `ONESIGNAL_API_KEY`).
