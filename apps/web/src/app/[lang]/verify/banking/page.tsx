import { VerifyBankingPage } from './_components/verify-banking-page';

type PageProps = {
  searchParams: Promise<{ token?: string | string[] }>;
};

export default async function BankingEmailVerifyPage({ searchParams }: PageProps) {
  const params = await searchParams;
  const rawToken = params.token;
  const token =
    typeof rawToken === 'string'
      ? rawToken
      : Array.isArray(rawToken)
      ? rawToken[0] ?? null
      : null;

  return <VerifyBankingPage token={token} />;
}
