### Infrastructure Security Best Practices

#### Do

- ✅ Enforce least-privilege IAM policies — no wildcard permissions, regular access reviews, just-in-time elevation
- ✅ Require MFA for all human access to cloud consoles, VPNs, and critical systems
- ✅ Encrypt data at rest (AES-256) and in transit (TLS 1.3) across all services
- ✅ Segment networks — separate production, staging, and development environments; isolate sensitive workloads
- ✅ Scan IaC templates (Terraform, CloudFormation) for misconfigurations before applying
- ✅ Use minimal base images for containers; scan for CVEs in CI and at runtime
- ✅ Centralise secrets in a dedicated manager (Vault, AWS Secrets Manager) with audited access and automatic rotation
- ✅ Enable cloud-native security tooling (GuardDuty, Security Hub, Cloud Armor, Azure Defender)
- ✅ Implement backup strategy (3-2-1 rule) and regularly test recovery procedures
- ✅ Maintain an asset inventory — know every service, endpoint, and data store in your environment
- ✅ Log all administrative actions, authentication events, and configuration changes with immutable audit trails

#### Avoid

- ❌ Using root/admin accounts for routine operations
- ❌ Exposing management ports (SSH, RDP, database) to the public internet
- ❌ Running containers as root or with privileged mode without justification
- ❌ Storing secrets in environment variables baked into container images or IaC state files
- ❌ Disabling security scanning to speed up pipelines
- ❌ Using self-signed certificates in production without proper trust chain
- ❌ Sharing credentials across environments (dev/staging/prod)
- ❌ Ignoring cloud provider security recommendations and benchmark findings
