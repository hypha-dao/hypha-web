### DevSecOps

- **CI/CD Pipeline Security:** Embedding security gates (SAST, DAST, SCA, secret scanning) into build and deployment pipelines. Configuring fail thresholds, bypass governance, and security quality gates that don't block velocity unnecessarily
- **Shift-Left Security:** Moving security testing earlier in the SDLC — IDE-integrated scanning, pre-commit hooks, and developer-facing security feedback loops that provide actionable guidance in context
- **Policy-as-Code:** Codifying security policies using OPA/Rego, Sentinel, or Kyverno. Automating enforcement of infrastructure and application security requirements in CI/CD and runtime environments
- **Software Supply Chain Security:** Managing SBOM generation (CycloneDX, SPDX), dependency vulnerability scanning (SCA), provenance verification (SLSA framework), and protecting against supply chain attack vectors (typosquatting, dependency confusion)
- **Automated Dependency Management:** Configuring Dependabot, Renovate, or Socket for automated vulnerability detection and patch PRs. Establishing merge policies that balance security urgency with stability requirements
- **Security Champions Programme:** Establishing and mentoring security champions embedded in development teams. Providing training, tooling, and escalation paths that distribute security expertise across the organisation
- **Security Metrics & Dashboards:** Tracking vulnerability density, mean time to detect (MTTD), mean time to remediate (MTTR), dependency freshness, security test coverage, and compliance rates. Building dashboards for engineering and leadership visibility
