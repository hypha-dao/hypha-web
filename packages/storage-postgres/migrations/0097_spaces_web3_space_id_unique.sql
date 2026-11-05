CREATE UNIQUE INDEX IF NOT EXISTS "spaces_web3_space_id_unique" ON "spaces" USING btree ("web3_space_id") WHERE "spaces"."web3_space_id" is not null and "spaces"."slug" <> 'zz-w3-probe-1220';
