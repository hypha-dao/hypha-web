CREATE TABLE "transfers" (
	"id" serial PRIMARY KEY NOT NULL,
	"transaction_hash" text NOT NULL,
	"memo" text,
	CONSTRAINT "transfers_transaction_hash_unique" UNIQUE("transaction_hash")
);
