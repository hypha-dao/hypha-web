import { expect } from 'chai';
import { ignition, ethers } from 'hardhat';

import spaceFactoryProxyModule from '../ignition/modules/SpaceFactoryProxy';
import spaceFactoryUpgradeModule from '../ignition/modules/SpaceFactoryProxyUpgrade';

describe('SpaceFactoryProxy', function () {
  describe('SpaceFactoryProxy interaction', function () {
    it('Should be interactable via proxy', async function () {
      const [, otherAccount] = await ethers.getSigners();

      const { spaceFactoryV1 } = await ignition.deploy(spaceFactoryProxyModule);

      expect(
        await (spaceFactoryV1 as any).connect(otherAccount).version(),
      ).to.equal('1.0.0');
    });
  });

  describe('Upgrading SpaceFactory', function () {
    it('Should have upgraded the proxy to SpaceFactoryV2', async function () {
      const [, otherAccount] = await ethers.getSigners();

      const { demo } = await ignition.deploy(spaceFactoryUpgradeModule);

      expect(await (demo as any).connect(otherAccount).version()).to.equal(
        '2.0.0',
      );
    });

    it('Should have set the name during upgrade', async function () {
      const [, otherAccount] = await ethers.getSigners();

      const { demo } = await ignition.deploy(spaceFactoryUpgradeModule);

      expect(await (demo as any).connect(otherAccount).name()).to.equal(
        'Example Name',
      );
    });
  });
});
