# Best Practices

1. **Authentication**: Use environment variables for automation

   ```bash
   export GH_TOKEN=$(gh auth token)
   ```

2. **Default Repository**: Set default to avoid repetition

   ```bash
   gh repo set-default owner/repo
   ```

3. **JSON Parsing**: Use jq for complex data extraction

   ```bash
   gh pr list --json number,title --jq '.[] | select(.title | contains("fix"))'
   ```

4. **Limiting Results**: Use --limit for gh issue list (--paginate applies only to gh api)

   ```bash
   gh issue list --state all --limit 200
   ```

5. **Large responses**: Use --paginate for gh api endpoints that return many items

   ```bash
   gh api /user/repos --paginate
   ```
