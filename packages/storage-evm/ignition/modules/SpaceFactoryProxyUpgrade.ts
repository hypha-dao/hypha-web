import { buildModule } from '@nomicfoundation/hardhat-ignition/modules';

import SpaceFactoryProxy from './SpaceFactoryProxy';

/**
 * This module upgrades the proxy to a new version of the Demo contract.
 */
const spaceFactoryProxyUpgradeModule = buildModule(
  'SpaceFactoryProxyUpgradeModule',
  (m) => {
    // Make sure we're using the account that owns the ProxyAdmin contract.
    const proxyAdminOwner = m.getAccount(0);

    // Get the proxy and proxy admin from the previous module.
    const { proxyAdmin, proxy } = m.useModule(SpaceFactoryProxy);

    // This is the new version of the Demo contract that we want to upgrade to.
    const spaceFactoryV2 = m.contract('SpaceFactoryV2');

    // The `upgradeAndCall` function on the ProxyAdmin contract allows us to upgrade the proxy
    // and call a function on the new implementation contract in a single transaction.
    // To do this, we need to encode the function call data for the function we want to call.
    // We'll then pass this encoded data to the `upgradeAndCall` function.
    const encodedFunctionCall = m.encodeFunctionCall(
      spaceFactoryV2,
      'setName',
      ['Example Name'],
    );

    // Upgrade the proxy to the new version of the Demo contract.
    // This function also accepts a data parameter, which accepts encoded function call data.
    // We pass the encoded function call data we created above to the `upgradeAndCall` function
    // so that the `setName` function is called on the new implementation contract after the upgrade.
    m.call(
      proxyAdmin,
      'upgradeAndCall',
      [proxy, spaceFactoryV2, encodedFunctionCall],
      {
        from: proxyAdminOwner,
      },
    );

    // Return the proxy and proxy admin so that they can be used by other modules.
    return { proxyAdmin, proxy };
  },
);

/**
 * This is the final module that will be run.
 *
 * It takes the proxy from the previous module and uses it to create a local contract instance
 * for the DemoV2 contract. This allows us to interact with the DemoV2 contract via the proxy.
 */
const spaceFactoryV2 = buildModule('SpaceFactoryV2Module', (m) => {
  // Get the proxy from the previous module.
  const { proxy } = m.useModule(spaceFactoryProxyUpgradeModule);

  // Create a local contract instance for the DemoV2 contract.
  // This line tells Hardhat Ignition to use the DemoV2 ABI for the contract at the proxy address.
  // This allows us to call functions on the DemoV2 contract via the proxy.
  const demo = m.contractAt('SpaceFactoryV2', proxy);

  // Return the contract instance so that it can be used by other modules or in tests.
  return { demo };
});

export default spaceFactoryV2;
