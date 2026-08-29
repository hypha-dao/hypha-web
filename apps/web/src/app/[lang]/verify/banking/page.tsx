import { VerifyBankingPage } from './_components/verify-banking-page';

type PageProps = {
  searchParams?: Promise<{ token?: string }>;
};

/** Public page (#2288) — no Privy auth gate. See VerifyBankingPage for details. */
export default async function Page(props: PageProps) {
  const searchParams = await props.searchParams;
  const token = searchParams?.token?.trim() || null;

  return <VerifyBankingPage token={token} />;
}
