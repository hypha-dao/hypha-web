-- #2608 authorization server (Better Auth under packages/auth-server). Additive only.
-- Tables are prefixed as_ so they cannot collide with the app's own tables. as_user.id is the
-- Privy user id and is tied to people.sub: there is no second identity store; deleting a person
-- removes their authorization-server records.
-- Hand-authored (repo convention: IF NOT EXISTS; drizzle-kit generate/migrate/push are not used).
-- Column names are Better Auth's own (camelCase, quoted); the library reads and writes them.
-- Row level security is enabled with no policies: only the owning (server) role can read these tables.
CREATE TABLE IF NOT EXISTS "as_user" ("id" text not null primary key references "people" ("sub") on delete cascade, "name" text not null, "email" text not null unique, "emailVerified" boolean not null, "image" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_session" ("id" text not null primary key, "expiresAt" timestamptz not null, "token" text not null unique, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null, "ipAddress" text, "userAgent" text, "userId" text not null references "as_user" ("id") on delete cascade);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_account" ("id" text not null primary key, "accountId" text not null, "providerId" text not null, "userId" text not null references "as_user" ("id") on delete cascade, "accessToken" text, "refreshToken" text, "idToken" text, "accessTokenExpiresAt" timestamptz, "refreshTokenExpiresAt" timestamptz, "scope" text, "password" text, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_verification" ("id" text not null primary key, "identifier" text not null, "value" text not null, "expiresAt" timestamptz not null, "createdAt" timestamptz default CURRENT_TIMESTAMP not null, "updatedAt" timestamptz default CURRENT_TIMESTAMP not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_jwks" ("id" text not null primary key, "publicKey" text not null, "privateKey" text not null, "createdAt" timestamptz not null, "expiresAt" timestamptz, "alg" text, "crv" text);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_client" ("id" text not null primary key, "clientId" text not null unique, "clientSecret" text, "clientDiscoveryId" text, "disabled" boolean, "skipConsent" boolean, "enableEndSession" boolean, "subjectType" text, "scopes" jsonb, "clientCredentialsScopes" jsonb, "userId" text references "as_user" ("id") on delete cascade, "createdAt" timestamptz, "updatedAt" timestamptz, "name" text, "uri" text, "icon" text, "contacts" jsonb, "tos" text, "policy" text, "softwareId" text, "softwareVersion" text, "softwareStatement" text, "redirectUris" jsonb not null, "postLogoutRedirectUris" jsonb, "backchannelLogoutUri" text, "backchannelLogoutSessionRequired" boolean, "tokenEndpointAuthMethod" text, "applicationType" text, "jwks" text, "jwksUri" text, "grantTypes" jsonb, "responseTypes" jsonb, "requirePKCE" boolean, "dpopBoundAccessTokens" boolean, "referenceId" text, "metadata" jsonb);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_resource" ("id" text not null primary key, "identifier" text not null unique, "name" text not null, "accessTokenTtl" integer, "refreshTokenTtl" integer, "signingAlgorithm" text, "signingKeyId" text, "allowedScopes" jsonb, "customClaims" jsonb, "dpopBoundAccessTokensRequired" boolean, "disabled" boolean, "createdAt" timestamptz, "updatedAt" timestamptz, "policyVersion" integer, "metadata" jsonb);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_client_resource" ("id" text not null primary key, "clientId" text not null references "as_oauth_client" ("clientId") on delete cascade, "resourceId" text not null references "as_oauth_resource" ("identifier") on delete cascade, "metadata" jsonb, "createdAt" timestamptz);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_refresh_token" ("id" text not null primary key, "token" text not null unique, "clientId" text not null references "as_oauth_client" ("clientId") on delete cascade, "sessionId" text references "as_session" ("id") on delete set null, "userId" text not null references "as_user" ("id") on delete cascade, "referenceId" text, "authorizationCodeId" text, "resources" jsonb, "requestedUserInfoClaims" jsonb, "expiresAt" timestamptz not null, "createdAt" timestamptz not null, "revoked" timestamptz, "rotatedAt" timestamptz, "rotationReplayResponse" text, "rotationReplayExpiresAt" timestamptz, "authTime" timestamptz, "confirmation" jsonb, "scopes" jsonb not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_access_token" ("id" text not null primary key, "token" text not null unique, "clientId" text not null references "as_oauth_client" ("clientId") on delete cascade, "sessionId" text references "as_session" ("id") on delete set null, "userId" text references "as_user" ("id") on delete cascade, "referenceId" text, "authorizationCodeId" text, "resources" jsonb, "requestedUserInfoClaims" jsonb, "refreshId" text references "as_oauth_refresh_token" ("id") on delete cascade, "expiresAt" timestamptz not null, "createdAt" timestamptz not null, "revoked" timestamptz, "confirmation" jsonb, "scopes" jsonb not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_consent" ("id" text not null primary key, "clientId" text not null references "as_oauth_client" ("clientId") on delete cascade, "userId" text references "as_user" ("id") on delete cascade, "referenceId" text, "resources" jsonb, "requestedUserInfoClaims" jsonb, "scopes" jsonb not null, "createdAt" timestamptz not null, "updatedAt" timestamptz not null);
--> statement-breakpoint
CREATE TABLE IF NOT EXISTS "as_oauth_client_assertion" ("id" text not null primary key, "expiresAt" timestamptz not null);
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_session_userId_idx" on "as_session" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_account_userId_idx" on "as_account" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_verification_identifier_idx" on "as_verification" ("identifier");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_client_userId_idx" on "as_oauth_client" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_client_resource_clientId_idx" on "as_oauth_client_resource" ("clientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_client_resource_resourceId_idx" on "as_oauth_client_resource" ("resourceId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_refresh_token_clientId_idx" on "as_oauth_refresh_token" ("clientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_refresh_token_sessionId_idx" on "as_oauth_refresh_token" ("sessionId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_refresh_token_userId_idx" on "as_oauth_refresh_token" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_refresh_token_authorizationCodeId_idx" on "as_oauth_refresh_token" ("authorizationCodeId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_access_token_clientId_idx" on "as_oauth_access_token" ("clientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_access_token_sessionId_idx" on "as_oauth_access_token" ("sessionId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_access_token_userId_idx" on "as_oauth_access_token" ("userId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_access_token_authorizationCodeId_idx" on "as_oauth_access_token" ("authorizationCodeId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_access_token_refreshId_idx" on "as_oauth_access_token" ("refreshId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_consent_clientId_idx" on "as_oauth_consent" ("clientId");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "as_oauth_consent_userId_idx" on "as_oauth_consent" ("userId");
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "as_oauth_client_resource_clientId_resourceId_uidx" on "as_oauth_client_resource" ("clientId", "resourceId");
--> statement-breakpoint
ALTER TABLE "as_user" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_session" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_account" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_verification" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_jwks" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_client" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_resource" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_client_resource" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_refresh_token" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_access_token" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_consent" ENABLE ROW LEVEL SECURITY;
--> statement-breakpoint
ALTER TABLE "as_oauth_client_assertion" ENABLE ROW LEVEL SECURITY;
