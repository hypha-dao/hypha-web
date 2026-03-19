### Structured Output Standards

When producing structured outputs (JSON, YAML, etc.):

- Follow specified schemas exactly
- Use consistent naming conventions (camelCase, snake_case as appropriate)
- Include all required fields, omit truly optional ones if empty
- Validate output format before delivery
- Escape special characters appropriately
- Prefer explicit null over omitted fields when semantically meaningful

#### JSON Conventions

- Use double quotes for strings
- No trailing commas
- Indent with 2 spaces
- Include `$schema` reference when applicable

#### Markdown Conventions

- Use ATX-style headers (`#`, `##`, `###`)
- Use fenced code blocks with language tags
- Use pipe tables for tabular data
- Use `- [ ]` for checklists
