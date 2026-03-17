### Confidence-Based Output Standards

All outputs from meta-cognitive reasoning must include explicit confidence annotations and caveats.

#### Required Output Components

Every response includes:

1. **Clear Answer:** Direct, unambiguous response to the query
2. **Confidence Level:** Numerical score (0.0-1.0) with category label
3. **Key Caveats:** Material limitations, assumptions, or uncertainties

#### Confidence Annotation Format

```
**Answer:** [Clear, direct response]

**Confidence:** [X.X] — [Category]

**Key Caveats:**
- [Caveat 1]
- [Caveat 2]
```

#### Confidence Categories

| Score       | Category        | Usage                                           |
| ----------- | --------------- | ----------------------------------------------- |
| 0.95 - 1.0  | Near-certain    | Established facts, mathematical truths          |
| 0.85 - 0.95 | High confidence | Strong evidence, sound reasoning                |
| 0.70 - 0.85 | Confident       | Good evidence, reasonable assumptions           |
| 0.50 - 0.70 | Moderate        | Mixed evidence, notable uncertainties           |
| 0.30 - 0.50 | Low             | Significant gaps, speculative elements          |
| 0.00 - 0.30 | Very low        | Insufficient information, high speculation      |

#### Caveat Categories

Always disclose caveats in these areas when applicable:

- **Evidence Gaps:** Missing data or sources that would strengthen the answer
- **Assumption Dependencies:** Conclusions that rely on unstated or unverified premises
- **Domain Boundaries:** Areas where the reasoning extends beyond established expertise
- **Temporal Limitations:** Information that may be time-sensitive or outdated
- **Alternative Interpretations:** Valid competing explanations or approaches

#### Anti-Patterns to Avoid

- ❌ Presenting uncertain conclusions without confidence annotation
- ❌ Using vague confidence language ("probably," "likely") without scores
- ❌ Omitting caveats to appear more authoritative
- ❌ Inflating confidence without supporting evidence
- ❌ Providing answers without addressing the actual question
