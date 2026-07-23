'use client';

import React from 'react';
import { useTranslations } from 'next-intl';
import { z } from 'zod';
import {
  createAgreementFiles,
  percentageStringToBigInt,
  schemaCreateAgreementForm,
  type Person,
  type Space,
} from '@hypha-platform/core/client';
import { CreateEnergyProposalForm } from './create-energy-proposal-form';
import { RegisterEnergySourcePlugin } from '../../agreements/plugins/register-energy-source/plugin';
import { DEFAULT_BASE_PRICE_PER_KWH } from '../../agreements/plugins/enable-energy-community/plugin';
import { createPercentageStringSchema } from '../../agreements/plugins/enable-energy-community/energy-form-fields';

const ADDRESS_RE = /^0x[a-fA-F0-9]{40}$/;

const createEnergySourceSchema = (t: (key: string) => string) => {
  const percentageString = createPercentageStringSchema(t);
  const ownerRowSchema = z.object({
    recipient: z
      .string()
      .trim()
      .regex(ADDRESS_RE, t('validation.selectMemberOrSpace')),
    percentage: percentageString,
  });

  return z
    .object({
      name: z.string().trim().min(1, t('validation.sourceNameRequired')),
      sourceType: z.enum(['SOLAR', 'BATTERY']),
      owners: z.array(ownerRowSchema).min(1, t('validation.addOwner')),
      tokenName: z.string().trim().optional(),
      tokenSymbol: z.string().trim().optional(),
    })
    .superRefine((value, ctx) => {
      let totalBps = 0n;
      let valid = true;
      for (const owner of value.owners) {
        try {
          totalBps += percentageStringToBigInt(owner.percentage);
        } catch {
          valid = false;
        }
      }
      if (valid && value.owners.length > 0 && totalBps !== 10000n) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['owners'],
          message: t('validation.ownershipTotal100'),
        });
      }
    });
};

export const CreateRegisterEnergySourceForm = ({
  spaceId,
  web3SpaceId,
  successfulUrl,
  backUrl,
  members = [],
  spaces = [],
}: {
  spaceId: number | undefined | null;
  web3SpaceId: number | undefined | null;
  successfulUrl: string;
  backUrl?: string;
  members?: Person[];
  spaces?: Space[];
}) => {
  const tAgreementFlow = useTranslations('AgreementFlow');
  const t = useTranslations('Energy');

  const schema = React.useMemo(
    () =>
      schemaCreateAgreementForm.extend(createAgreementFiles).extend({
        energySource: createEnergySourceSchema((key) => t(key)),
      }),
    [t],
  );

  type FormValues = z.infer<typeof schema>;

  return (
    <CreateEnergyProposalForm<FormValues>
      schema={schema}
      label={tAgreementFlow('labels.registerEnergySource')}
      stickyHeaderTitle={t('forms.stickyHeaders.registerEnergySource')}
      resubmitTemplateSegment="register-energy-source"
      spaceId={spaceId}
      web3SpaceId={web3SpaceId}
      successfulUrl={successfulUrl}
      backUrl={backUrl}
      plugin={<RegisterEnergySourcePlugin members={members} spaces={spaces} />}
      defaultValues={
        {
          energySource: {
            name: '',
            sourceType: 'SOLAR',
            owners: [],
            tokenName: '',
            tokenSymbol: '',
          },
        } as Partial<FormValues>
      }
      mapPayload={(values) => {
        const source = values.energySource;
        return {
          sources: [
            {
              name: `${source.tokenName?.trim() || source.name.trim()} [${
                source.sourceType
              }]`,
              pricePerKwh: `${Number(DEFAULT_BASE_PRICE_PER_KWH).toFixed(
                2,
              )}/kWh`,
              owners: source.owners.map(
                (owner) =>
                  `${owner.recipient}: ${(
                    Number(percentageStringToBigInt(owner.percentage)) / 100
                  ).toFixed(2)}%`,
              ),
            },
          ],
        };
      }}
    />
  );
};
