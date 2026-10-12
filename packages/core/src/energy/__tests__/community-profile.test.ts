import { describe, expect, it } from 'vitest';

import {
  EMS_OBJECTIVE_INDEX,
  emsObjectiveFromBasePurpose,
  normalizeCommunitySetup,
  readEnergyCommunitySetup,
} from '../community-profile';

const setup = {
  emsObjective: 'MaximumSelfConsumption',
  onChainPurposeIndex: 0,
  address: 'Ponta do Sol, Madeira, Portugal',
  countryIso: 'PT',
  timeZone: 'Europe/Lisbon',
};

describe('emsObjectiveFromBasePurpose', () => {
  it('maps the on-chain purposes that have an EMS equivalent', () => {
    expect(emsObjectiveFromBasePurpose('SELF_CONSUMPTION')).toBe(
      'MaximumSelfConsumption',
    );
    expect(emsObjectiveFromBasePurpose('LOWEST_PRICE')).toBe('LowestPrice');
    expect(emsObjectiveFromBasePurpose('MIN_CO2')).toBeNull();
  });
});

describe('normalizeCommunitySetup', () => {
  it('keeps the EMS string and its integer code', () => {
    expect(normalizeCommunitySetup(setup)).toMatchObject({
      emsObjective: 'MaximumSelfConsumption',
      emsObjectiveIndex: EMS_OBJECTIVE_INDEX.MaximumSelfConsumption,
      onChainPurposeIndex: 0,
      countryIso: 'PT',
      address: 'Ponta do Sol, Madeira, Portugal',
      timeZone: 'Europe/Lisbon',
    });
    expect(EMS_OBJECTIVE_INDEX).toEqual({
      LowestPrice: 0,
      MaximumSelfConsumption: 1,
      BatteryFirst: 2,
    });
  });

  it('uses the country name and time zone when only a country is set', () => {
    expect(
      normalizeCommunitySetup({
        countryIso: 'PT',
        emsObjective: '',
      }),
    ).toMatchObject({
      address: 'Portugal',
      countryIso: 'PT',
      timeZone: 'Europe/Lisbon',
      emsObjective: null,
      emsObjectiveIndex: null,
    });
  });

  it('keeps the country when the objective has no energy-system equivalent', () => {
    expect(
      normalizeCommunitySetup({ ...setup, emsObjective: 'MIN_CO2' }),
    ).toMatchObject({
      emsObjective: null,
      emsObjectiveIndex: null,
      countryIso: 'PT',
      address: 'Ponta do Sol, Madeira, Portugal',
    });
  });
});

describe('readEnergyCommunitySetup', () => {
  it('reads the setup embedded in an enable-energy-community proposal', () => {
    const description = [
      'Proposal body',
      '',
      '__hypha_energy_proposal__',
      JSON.stringify({
        proposalType: 'Enable Energy Community',
        payload: {
          contractMethod: 'deployCommunity',
          communitySetup: setup,
        },
      }),
      '__end_hypha_energy_proposal__',
      '',
    ].join('\n');

    expect(readEnergyCommunitySetup(description)?.address).toBe(
      'Ponta do Sol, Madeira, Portugal',
    );
    expect(readEnergyCommunitySetup(description)?.emsObjectiveIndex).toBe(1);
  });

  it('ignores proposals that do not deploy a community', () => {
    const description = [
      '__hypha_energy_proposal__',
      JSON.stringify({
        proposalType: 'Change Energy Optimization',
        payload: { contractMethod: 'setOptimization', communitySetup: setup },
      }),
      '__end_hypha_energy_proposal__',
    ].join('\n');

    expect(readEnergyCommunitySetup(description)).toBeNull();
  });
});
