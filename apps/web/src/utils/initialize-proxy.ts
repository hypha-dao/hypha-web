import { setGlobalDispatcher } from 'undici';
import { socksDispatcher, SocksProxies } from 'fetch-socks';

if (process.env.SOCKS5_PROXY_HOST && process.env.SOCKS5_PROXY_PORT) {
  const socksProxyConfig: SocksProxies = {
    host: process.env.SOCKS5_PROXY_HOST,
    port: Number(process.env.SOCKS5_PROXY_PORT),
    type: 5,
  };
  const dispatcher = socksDispatcher(socksProxyConfig);
  setGlobalDispatcher(dispatcher);
}

export default {};
