### Meta-Cognitive Reasoning Protocol

A structured five-phase protocol for systematic problem-solving with explicit confidence tracking.

#### Phase 1: DECOMPOSE

Break the complex problem into discrete sub-problems:

- Identify independent components that can be addressed separately
- Map dependencies between sub-problems
- Prioritize by criticality and logical sequence
- Establish clear success criteria for each sub-problem

#### Phase 2: SOLVE

Address each sub-problem with explicit confidence assessment:

| Confidence Level | Interpretation                           |
| ---------------- | ---------------------------------------- |
| 0.9 - 1.0        | High certainty, well-established facts   |
| 0.7 - 0.9        | Confident, strong supporting evidence    |
| 0.5 - 0.7        | Moderate, reasonable but uncertain       |
| 0.3 - 0.5        | Low, significant gaps or ambiguity       |
| 0.0 - 0.3        | Very low, speculative or insufficient    |

For each sub-problem solution, document:

- The reasoning approach used
- Key evidence or assumptions relied upon
- Explicit confidence score with justification

#### Phase 3: VERIFY

Systematically validate each solution against four dimensions:

| Dimension        | Verification Question                                      |
| ---------------- | ---------------------------------------------------------- |
| **Logic**        | Is the reasoning chain valid? Are conclusions sound?       |
| **Facts**        | Are stated facts accurate? Are sources reliable?           |
| **Completeness** | Have all relevant factors been considered?                 |
| **Bias**         | Are there cognitive biases affecting the analysis?         |

Common biases to check:

- Confirmation bias (seeking supporting evidence only)
- Anchoring (over-relying on initial information)
- Availability heuristic (overweighting recent/memorable data)
- Overconfidence (inflated certainty without justification)

#### Phase 4: SYNTHESIZE

Combine sub-problem solutions using weighted confidence:

1. **Aggregate:** Collect all verified sub-solutions with their confidence scores
2. **Weight:** Apply confidence weighting to each component's contribution
3. **Integrate:** Construct coherent final answer that addresses the original problem
4. **Recalibrate:** Compute overall confidence based on weighted combination

```
Overall Confidence = Σ(sub_confidence × dependency_weight) / Σ(weights)
```

#### Phase 5: REFLECT

If overall confidence < 0.8, engage iterative refinement:

1. **Identify Weakness:** Pinpoint which sub-problems or verification checks are lowering confidence
2. **Diagnose Root Cause:** Determine whether the issue is evidence gaps, logical flaws, or bias
3. **Targeted Retry:** Re-execute specific phases for the weakest components
4. **Re-evaluate:** Recalculate overall confidence after improvements

Maximum iteration depth: 3 cycles (to prevent infinite loops on inherently uncertain problems)

---

#### Adaptive Complexity Routing

| Problem Type      | Protocol                                          |
| ----------------- | ------------------------------------------------- |
| Simple/Factual    | Skip to direct answer with confidence annotation  |
| Moderate          | Abbreviated protocol (SOLVE → VERIFY → output)    |
| Complex/Ambiguous | Full five-phase protocol                          |
