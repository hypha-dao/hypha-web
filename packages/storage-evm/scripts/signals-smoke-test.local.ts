import { ethers, upgrades } from 'hardhat';

// Local smoke test for SignalsImplementation:
//   npx hardhat run scripts/signals-smoke-test.local.ts
async function main(): Promise<void> {
  const [deployer, relayer, voter] = await ethers.getSigners();

  const Signals = await ethers.getContractFactory('SignalsImplementation');
  const signals = await upgrades.deployProxy(
    Signals,
    [await deployer.getAddress()],
    { initializer: 'initialize', kind: 'uups' },
  );
  await signals.waitForDeployment();
  console.log('deployed:', await signals.getAddress());

  await (await signals.setRelayer(await relayer.getAddress(), true)).wait();

  // Relayer records an upvote
  const tx = await signals
    .connect(relayer)
    .recordUpvote(241, 123, await voter.getAddress(), 500n * 10n ** 18n);
  const receipt = await tx.wait();
  const event = receipt.logs
    .map((log: { topics: string[]; data: string }) =>
      signals.interface.parseLog(log),
    )
    .find(
      (parsed: { name: string } | null) => parsed?.name === 'SignalUpvoted',
    );
  console.log('SignalUpvoted:', event?.args.toString());

  // Relayer records a removal
  const tx2 = await signals
    .connect(relayer)
    .recordUpvoteRemoval(241, 123, await voter.getAddress());
  await tx2.wait();
  console.log('upvote removal ok');

  // Relayer records a downvote
  const tx3 = await signals
    .connect(relayer)
    .recordDownvote(241, 456, await voter.getAddress(), 250n * 10n ** 18n);
  const receipt3 = await tx3.wait();
  const downvoteEvent = receipt3.logs
    .map((log: { topics: string[]; data: string }) =>
      signals.interface.parseLog(log),
    )
    .find(
      (parsed: { name: string } | null) => parsed?.name === 'SignalDownvoted',
    );
  console.log('SignalDownvoted:', downvoteEvent?.args.toString());

  // Relayer records a downvote removal
  const tx4 = await signals
    .connect(relayer)
    .recordDownvoteRemoval(241, 456, await voter.getAddress());
  await tx4.wait();
  console.log('downvote removal ok');

  // Unauthorized caller must revert
  try {
    await signals
      .connect(voter)
      .recordUpvote(241, 123, await voter.getAddress(), 1n);
    throw new Error('unauthorized call did not revert');
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (!message.includes('Not an authorized relayer')) throw error;
    console.log('unauthorized caller reverted as expected');
  }

  console.log('SMOKE_OK');
}

main()
  .then(() => process.exit(0))
  .catch((error: Error) => {
    console.error(error);
    process.exit(1);
  });
