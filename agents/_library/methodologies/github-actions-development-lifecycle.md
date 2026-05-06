### GitHub Actions Development Lifecycle

#### 1. Requirements Analysis
- Identify pipeline triggers and event sources
- Map deployment targets and environments
- Catalog required secrets, permissions, and integrations
- Define success criteria and quality gates

#### 2. Workflow Design
- Sketch job dependency graph and data flow
- Choose between inline steps, composite actions, and reusable workflows
- Design matrix strategies for multi-platform/multi-version testing
- Plan caching and artifact strategies

#### 3. Implementation
- Write workflow YAML with clear structure and comments
- Implement reusable components (composite actions, reusable workflows)
- Configure environments, secrets, and protection rules
- Set up concurrency groups and path filters

#### 4. Testing & Validation
- Validate syntax with `actionlint` or GitHub's workflow editor
- Test in feature branches with `workflow_dispatch` for manual triggers
- Verify all conditional paths execute correctly
- Confirm cache hit/miss behavior and artifact flow

#### 5. Security Review
- Audit permissions scope on every workflow and job
- Verify third-party actions are pinned to SHA
- Check for script injection vulnerabilities
- Validate secret scoping and environment protection

#### 6. Optimization
- Analyze workflow run durations and identify bottlenecks
- Tune caching strategies based on hit rate metrics
- Optimize matrix configurations and parallelism
- Review runner costs and right-size runner selection

#### 7. Monitoring & Maintenance
- Track workflow success rates and flaky tests
- Set up notifications for workflow failures (Slack, email, issues)
- Schedule regular dependency and action version updates
- Archive or remove obsolete workflows
