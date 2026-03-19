# Releases (gh release)

```bash
# List releases
gh release list

# View latest release
gh release view

# View specific release
gh release view v1.0.0

# View in browser
gh release view v1.0.0 --web

# Create release
gh release create v1.0.0 \
  --notes "Release notes here"

# Create release with notes from file
gh release create v1.0.0 --notes-file notes.md

# Create release with target
gh release create v1.0.0 --target main

# Create release as draft
gh release create v1.0.0 --draft

# Create pre-release
gh release create v1.0.0 --prerelease

# Create release with title
gh release create v1.0.0 --title "Version 1.0.0"

# Upload asset to release
gh release upload v1.0.0 ./file.tar.gz

# Upload multiple assets
gh release upload v1.0.0 ./file1.tar.gz ./file2.tar.gz

# Upload with asset label
gh release upload v1.0.0 "./file.tar.gz#Linux x86_64"

# Delete release
gh release delete v1.0.0

# Delete with cleanup tag
gh release delete v1.0.0 --cleanup-tag --yes

# Delete specific asset
gh release delete-asset v1.0.0 file.tar.gz

# Download release assets
gh release download v1.0.0

# Download specific asset
gh release download v1.0.0 --pattern "*.tar.gz"

# Download to directory
gh release download v1.0.0 --dir ./downloads

# Download archive (zip/tar)
gh release download v1.0.0 --archive zip

# Edit release
gh release edit v1.0.0 --notes "Updated notes"

# Verify release signature
gh release verify v1.0.0

# Verify specific asset
gh release verify-asset v1.0.0 file.tar.gz
```
