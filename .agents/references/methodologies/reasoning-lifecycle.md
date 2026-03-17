### Reasoning Lifecycle

A lifecycle model for meta-cognitive reasoning engagements, from problem intake to validated output.

#### Stage 1: Problem Intake

**Objective:** Understand and classify the incoming problem

| Activity                | Output                              |
| ----------------------- | ----------------------------------- |
| Parse the question/task | Clear problem statement             |
| Assess complexity       | Simple / Moderate / Complex rating  |
| Identify constraints    | Time, scope, domain boundaries      |
| Route to protocol       | Direct answer vs. structured reason |

**Decision Gate:** Determine if full meta-cognitive protocol is warranted

#### Stage 2: Structured Reasoning

**Objective:** Apply appropriate reasoning depth based on complexity

For **Simple Problems:**

- Provide direct answer
- Annotate with confidence
- List any caveats

For **Complex Problems:**

- Execute full DECOMPOSE → SOLVE → VERIFY → SYNTHESIZE → REFLECT protocol
- Document intermediate reasoning states
- Track confidence evolution

#### Stage 3: Quality Validation

**Objective:** Ensure reasoning quality before output

| Check                | Criteria                                                |
| -------------------- | ------------------------------------------------------- |
| Logical soundness    | No fallacies, valid inference chains                    |
| Factual accuracy     | Claims are verifiable or flagged as uncertain           |
| Completeness         | All sub-problems addressed, no gaps                     |
| Bias mitigation      | Cognitive biases identified and addressed               |
| Confidence alignment | Stated confidence matches evidence strength             |

#### Stage 4: Output Delivery

**Objective:** Present results in confidence-annotated format

Required elements:

1. Clear, direct answer to the original problem
2. Confidence score with category label
3. Key caveats and limitations
4. (For complex problems) Brief reasoning summary if helpful

#### Stage 5: Iterative Refinement

**Objective:** Improve upon low-confidence outputs

Triggered when: Overall confidence < 0.8

Process:

1. Identify weakest reasoning components
2. Determine improvement strategy (more evidence, alternative approach, reduced scope)
3. Re-execute targeted phases
4. Re-validate and re-deliver

Maximum iterations: 3 (terminate with best-effort answer and explicit uncertainty flag)

---

#### Lifecycle Metrics

| Metric                   | Target                              |
| ------------------------ | ----------------------------------- |
| Confidence accuracy      | Stated confidence correlates with actual accuracy |
| Caveat completeness      | All material limitations disclosed  |
| Reasoning transparency   | Logic chain is auditable            |
| Efficiency               | Simple problems handled quickly     |
