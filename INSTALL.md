# Local Installation Guide

This guide helps you set up the project locally, run `apps/web`, and configure Git so commits are associated with your GitHub account.

## 1) Prerequisites

- Git installed
- Node.js version `20` (this matches the CI workflows)
- pnpm `9.x` (the repo uses `pnpm@9.15.0`)

## 2) Install and use the correct Node.js version

Choose one option:

### Option A: `nvm` / `nvm-windows`

```powershell
nvm install 20
nvm use 20
node -v
```

You should see a Node `20.x.x` version.

### Option B: `fnm`

```powershell
fnm install 20
fnm use 20
node -v
```

## 3) Enable pnpm and install dependencies

From the repository root:

```powershell
corepack enable
corepack prepare pnpm@9.15.0 --activate
pnpm -v
pnpm install
```

## 4) Configure app environment for `apps/web`

Create a local env file for the web app if it does not exist:

```powershell
Copy-Item "apps/web/.env.template" "apps/web/.env" -ErrorAction SilentlyContinue
```

Then fill in any required values in `apps/web/.env`.

## 5) Run the web app and open it in the browser

Run from the repo root:

```powershell
pnpm --filter web dev
```

Open:

- [http://localhost:3000](http://localhost:3000)

## 6) Configure Git identity for this repository

Set your identity at repository scope (recommended for shared machines):

```powershell
git config --local user.name "Your Name"
git config --local user.email "your-github-email@example.com"
```

Use an email that is verified in GitHub so commits are linked to your account.

Verify:

```powershell
git config --local --get user.name
git config --local --get user.email
git config --list --show-origin
```

## 7) Optional: enable Git commit signing (GitHub "Verified" badge)

Commit identity linking works without signing. If you also want the "Verified" badge in GitHub, configure signing (GPG or SSH signing) in your Git and GitHub settings.
