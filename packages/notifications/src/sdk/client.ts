import 'server-only';

import * as OneSignal from '@onesignal/node-onesignal';

export const sdkClient = (() => {
  const configuration = OneSignal.createConfiguration({
    restApiKey: process.env.ONESIGNAL_API_KEY,
  });

  return new OneSignal.DefaultApi(configuration);
})();
