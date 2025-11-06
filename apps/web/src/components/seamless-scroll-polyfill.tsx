'use client';

import React from 'react';
// Built-in scrollIntoView options are not supported
// in Safari before 14 so we need for this polyfill
import { polyfill } from 'seamless-scroll-polyfill';

export default function SeamlessScrollPolyfill() {
  React.useEffect(() => {
    polyfill();
  }, []);
  return <></>;
}
