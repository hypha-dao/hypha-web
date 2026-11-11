# Production deploys

How production gets deployed, and what that means when an environment variable changes.

## How it works

- Production is built and deployed by the **Deploy Production** workflow (`.github/workflows/deploy-production.yml`).
- It runs on every **push to `main`** (that is, on every merged PR). There is no manual trigger.
- The workflow runs the database migration, pulls the Production environment from Vercel (`vercel pull`, `vercel env pull`), builds with `vercel build --prod`, and uploads the result with `vercel deploy --prebuilt --prod`.

## What this means for environment variables

- Values read **at build time** (for example the `next.config` redirects, and the white-label host config `WHITE_LABEL_HOST_CONFIG`) are fixed when the workflow builds. Changing the variable in the Vercel dashboard does nothing until a **new workflow run** builds again.
- Because the deployment is prebuilt, the Vercel dashboard **Redeploy** button reuses the already built output. Do not rely on it to pick up a build-time variable.
- To apply a changed variable, re-run the **Deploy Production** workflow in GitHub Actions ("Re-run all jobs"), or merge a new commit to `main`.

## If the workflow does not start

A run that ends as `startup_failure` with no jobs was never started by GitHub. The API gives no reason; the run page shows a banner with the text. If a re-run keeps failing, a new push to `main` starts a fresh run.
