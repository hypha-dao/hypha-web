### Requirements Engineering Best Practices

#### Do

- ✅ Start from stakeholder problems and goals, not solution assumptions
- ✅ Use SHALL for mandatory requirements, SHOULD for recommended, MAY for optional
- ✅ Write acceptance criteria that are testable and unambiguous
- ✅ Assign unique IDs to every requirement (FR-*, NFR-*, AC-*)
- ✅ Maintain bidirectional traceability from goals to test cases
- ✅ Separate functional requirements from non-functional constraints
- ✅ Validate requirements with stakeholders before baselining
- ✅ Document assumptions, constraints, and open questions explicitly
- ✅ Version-control requirement documents and track change history
- ✅ Cross-reference related requirements and note dependencies

#### Avoid

- ❌ Unmeasurable language without thresholds (for example, "response time must be low" or "user-friendly interface")
- ❌ Using RFC-2119 terms like SHOULD without measurable criteria or explicit rationale
- ❌ Combining multiple requirements in a single statement
- ❌ Requirements that cannot be verified or tested
- ❌ Implicit assumptions left undocumented
- ❌ Scope creep through unmanaged change requests
- ❌ Gold-plating requirements beyond actual stakeholder needs
- ❌ Skipping non-functional requirements (performance, security, accessibility)
- ❌ Writing requirements in isolation without cross-functional input
