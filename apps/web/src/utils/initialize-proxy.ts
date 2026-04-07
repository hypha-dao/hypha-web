import { setGlobalDispatcher } from 'undici';
import { socksDispatcher, SocksProxies } from 'fetch-socks';

if (process.env.SOCKS5_PROXY_HOST && process.env.SOCKS5_PROXY_PORT) {
  try {
    const port = Number(process.env.SOCKS5_PROXY_PORT);

    if (isNaN(port) || port < 1 || port > 65535) {
      throw new Error(
        `Invalid SOCKS5_PROXY_PORT: ${process.env.SOCKS5_PROXY_PORT}. Must be a number between 1 and 65535.`,
      );
    }
    const socksProxyConfig: SocksProxies = {
      host: process.env.SOCKS5_PROXY_HOST,
      port: Number(process.env.SOCKS5_PROXY_PORT),
      type: 5,
    };
    const dispatcher = socksDispatcher(socksProxyConfig);
    setGlobalDispatcher(dispatcher);

    console.log(
      `[Proxy] SOCKS5 proxy configured: ${process.env.SOCKS5_PROXY_HOST}:${port}`,
    );
  } catch (error) {
    console.error('[Proxy] Failed to initialize SOCKS5 proxy:', error);
  }
}

export default {};
