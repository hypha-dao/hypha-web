import { buildModule } from "@nomicfoundation/hardhat-ignition/modules";

const SpaceFactoryModule = buildModule("SpaceFactoryModule", (m) => {
  const spaceFactory = m.contract("SpaceFactory");
  return { spaceFactory };
});

export default SpaceFactoryModule;
