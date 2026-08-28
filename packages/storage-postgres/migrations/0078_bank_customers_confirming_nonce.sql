-- #2288 follow-up: a resend rotating jwt_nonce mid-confirmation could be silently overwritten by
-- the in-flight confirmation's own (unconditional-by-id) final write, letting a stale link
-- complete anyway and bricking the freshly resent one. confirming_nonce tracks "this specific
-- confirmation attempt is in flight" independently of jwt_nonce (which resend still owns), so the
-- final write can be conditioned on it — see claimBankCustomerForConfirmation /
-- finalizeClaimedBankCustomer in bank-onboarding-confirmation.ts.
ALTER TABLE "bank_customers" ADD COLUMN "confirming_nonce" uuid;
