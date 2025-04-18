import { CHAIN_NAMESPACES, WEB3AUTH_NETWORK } from '@web3auth/base';
import { getDefaultExternalAdapters } from '@web3auth/default-evm-adapter';
import { EthereumPrivateKeyProvider } from '@web3auth/ethereum-provider';
import { Web3AuthOptions } from '@web3auth/modal';

const clientId = process.env.NEXT_PUBLIC_WEB3AUTH_CLIENT_ID!;

const chainConfig = {
  chainNamespace: CHAIN_NAMESPACES.EIP155,
  chainId: '0xaa36a7',
  rpcTarget: 'https://rpc.ankr.com/eth_sepolia',
  displayName: 'Ethereum Sepolia Testnet',
  blockExplorerUrl: 'https://sepolia.etherscan.io',
  ticker: 'ETH',
  tickerName: 'Ethereum',
  logo: 'https://cryptologos.cc/logos/ethereum-eth-logo.png',
};

const privateKeyProvider = new EthereumPrivateKeyProvider({
  config: {
    chainConfig,
  },
});

const web3AuthOptions: Web3AuthOptions = {
  chainConfig,
  clientId,
  web3AuthNetwork: WEB3AUTH_NETWORK.SAPPHIRE_DEVNET,
  privateKeyProvider,
};

const adapters = getDefaultExternalAdapters({ options: web3AuthOptions });
const filteredAdapters = adapters.filter(
  (adapter: any) => adapter.name !== 'wallet-connect-v2',
);

export const web3AuthContextConfig = {
  web3AuthOptions,
  adapters: [...filteredAdapters],
};

export default web3AuthContextConfig;
