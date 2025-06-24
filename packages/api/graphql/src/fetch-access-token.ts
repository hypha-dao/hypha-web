export const getAccessToken = async () => {
  const HYPHA_AUTH_URL = process.env.HYPHA_AUTH_URL;
  const CHAIN_NAME = process.env.CHAIN_NAME;
  const ENV = process.env.ENV || 'prod';
  const network = process.env.IS_TESTNET ? 'testnet' : 'mainnet';
  const url = `${HYPHA_AUTH_URL}?chain=${CHAIN_NAME}&env=${ENV}&network=${network}`;

  return fetch(url, {
    method: 'GET',
  }).then((res) => res.json());
};
