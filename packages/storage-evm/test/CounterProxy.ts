import { expect } from 'chai';
import { ethers, upgrades } from 'hardhat';
import { SignerWithAddress } from '@nomicfoundation/hardhat-ethers/signers';

describe('Counter Proxy', function () {
  let counter: any;
  let counterV2: any;
  let proxyAddress: string;
  let owner: SignerWithAddress;
  let addr1: SignerWithAddress;

  beforeEach(async function () {
    // Get signers
    [owner, addr1] = await ethers.getSigners();

    // Deploy initial implementation and proxy
    const Counter = await ethers.getContractFactory('Counter');
    counter = await upgrades.deployProxy(Counter, {
      initializer: 'initialize',
      kind: 'uups',
    });
    await counter.waitForDeployment();
    proxyAddress = await counter.getAddress();
  });

  it('Should initialize with the correct value', async function () {
    expect(await counter.getCount()).to.equal(0);
  });

  it('Should increment counter correctly', async function () {
    await counter.increment();
    expect(await counter.getCount()).to.equal(1);

    await counter.increment();
    expect(await counter.getCount()).to.equal(2);
  });

  it('Should upgrade to V2 and maintain state', async function () {
    // Increment counter in V1
    await counter.increment();
    expect(await counter.getCount()).to.equal(1);

    // Deploy and upgrade to V2
    const CounterV2 = await ethers.getContractFactory('CounterV2');
    counterV2 = await upgrades.upgradeProxy(proxyAddress, CounterV2);

    // Check state is maintained
    expect(await counterV2.getCount()).to.equal(1);

    // Test new V2 functionality - assuming V2 has an add method instead
    // If CounterV2 has different methods, replace this with the actual method
    if (typeof counterV2.add === 'function') {
      await counterV2.add(5);
      expect(await counterV2.getCount()).to.equal(6);
    } else {
      // Just test that we can still increment in V2
      await counterV2.increment();
      expect(await counterV2.getCount()).to.equal(2);
    }
  });

  it('Should only allow owner to upgrade', async function () {
    const CounterV2 = await ethers.getContractFactory('CounterV2', addr1);

    // Try to upgrade from non-owner account
    await expect(upgrades.upgradeProxy(proxyAddress, CounterV2.connect(addr1)))
      .to.be.reverted;
  });
});
