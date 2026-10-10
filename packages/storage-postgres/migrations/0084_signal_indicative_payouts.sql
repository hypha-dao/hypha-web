ALTER TABLE "coherences" ADD COLUMN IF NOT EXISTS "indicative_payouts" jsonb DEFAULT '[]'::jsonb NOT NULL;
