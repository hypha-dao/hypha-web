import { data } from './list.mock';
import { AgreementItem } from './types';

export const getAgreementBySlug = async (
  slug: string,
): Promise<AgreementItem | undefined> => {
  return new Promise((resolve) => {
    setTimeout(() => {
      resolve(data.find((agreement) => agreement.slug === slug));
    }, 100);
  });
};
