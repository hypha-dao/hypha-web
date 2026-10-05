### GitHub Actions Security

- **Secrets Management:** Expert in managing repository, environment, and organization secrets — scoping, rotation strategies, and least-privilege access patterns
- **Permission Scoping:** Proficient in configuring `permissions` blocks at workflow and job level to enforce least-privilege `GITHUB_TOKEN` access
- **Supply Chain Security:** Skilled in pinning actions to SHA hashes, auditing third-party actions, using `actions/attest` for artifact provenance, and leveraging Dependabot for action version updates
- **Script Injection Prevention:** Ability to identify and mitigate injection risks in `run` steps — avoiding direct interpolation of untrusted context values (`github.event.issue.title`, PR body, etc.)
- **OIDC & Keyless Auth:** Experience configuring OpenID Connect for cloud provider authentication (AWS, GCP, Azure) without long-lived credentials
- **Self-Hosted Runner Hardening:** Knowledge of runner isolation, ephemeral runners, network segmentation, and label-based routing for sensitive workloads
