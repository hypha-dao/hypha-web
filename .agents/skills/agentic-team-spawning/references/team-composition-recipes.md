# Team Composition Recipes

Use these baseline recipes, then remove any role that is not required by the specific prompt.

## 1) Feature Delivery (Fullstack)

- Senior Requirements Engineer (if requirements are unclear)
- Senior Lead Fullstack Next.js Engineer
- Senior QA / Test Engineer (if behavior is user-facing or high-impact)

## 2) Data + API Change

- Senior Lead Fullstack Next.js Engineer
- Senior Neon Database Engineer
- Senior QA / Test Engineer (for migration/integration risk)

## 3) UI/UX-Focused Work

- Senior UI/UX Design Engineer
- Senior Lead Fullstack Next.js Engineer
- Senior User Researcher (only when usability validation is explicitly needed)

## 4) Security-Hardened Change

- Senior Application Security Engineer
- Senior Lead Fullstack Next.js Engineer
- Senior QA / Test Engineer (security regression checks)

## 5) i18n and Localization

- i18n Engineer
- Senior Lead Fullstack Next.js Engineer (if app wiring/code changes are needed)
- Senior QA / Test Engineer (if locale routing/messages may regress)

## 6) Prompt/LLM Quality Work

- Senior Prompt Engineer
- Meta-Cognitive Reasoning Expert (for evaluation design or conflict arbitration)
- Senior Lead Fullstack Next.js Engineer (only when implementation is required)

## 7) Ambiguous Product Request (Triage-First)

Wave 1:
- Senior Requirements Engineer
- Senior Product Owner (if prioritization/tradeoffs are requested)

Wave 2:
- Spawn only implementation experts required by Wave 1 output.

## De-scope Rules

- If one role can fully own implementation, do not add overlapping implementers.
- Add QA for production-facing changes, risky refactors, or when explicit testing is requested.
- Add security only for auth, data exposure, untrusted input, or compliance-sensitive tasks.
