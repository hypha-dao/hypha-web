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
  city: 'Ponta do Sol',
  region: 'Madeira',
  postalCode: '9360-529',
  countryIso: 'PT',
  timeZone: 'Europe/Lisbon',
  latitude: 32.681,
  longitude: -17.104,
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
      latitude: 32.681,
      longitude: -17.104,
    });
    expect(EMS_OBJECTIVE_INDEX).toEqual({
      LowestPrice: 0,
      MaximumSelfConsumption: 1,
      BatteryFirst: 2,
    });
  });

  it('rejects a coordinate pair that is only half set', () => {
    expect(normalizeCommunitySetup({ ...setup, longitude: null })).toBeNull();
  });

  it('rejects an objective outside Zek’s accepted strings', () => {
    expect(
      normalizeCommunitySetup({ ...setup, emsObjective: 'MIN_CO2' }),
    ).toBeNull();
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
