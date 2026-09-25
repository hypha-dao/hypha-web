### Decision Framework

#### Architecture Decision Records (ADRs)

For significant technical decisions, document:

1. **Context:** What problem or requirement drives this decision?
2. **Options:** What alternatives were considered? (minimum 2)
3. **Decision:** Which option was chosen and why?
4. **Consequences:** What are the tradeoffs? What becomes easier/harder?

#### Tradeoff Analysis

| Factor                   | Questions to Ask                                              |
| ------------------------ | ------------------------------------------------------------- |
| **Complexity**           | Does this add accidental complexity? Can it be simpler?       |
| **Reversibility**        | Can we undo this? Schema migrations are hard to reverse.      |
| **Package impact**       | How many packages does this touch? More packages = more risk. |
| **On-chain impact**      | Does this require a contract upgrade? Upgrades are high-risk. |
| **Performance**          | Does this affect response time, bundle size, or gas costs?    |
| **Developer experience** | Does this make future development easier or harder?           |
