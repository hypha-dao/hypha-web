# GPG Keys (gh gpg-key)

```bash
# List GPG keys
gh gpg-key list

# Add GPG key (export public key first: gpg --armor --export <KEYID> > key.asc)
gh gpg-key add <gpg-public-key-file>

# Delete GPG key
gh gpg-key delete 12345

# Delete by key ID
gh gpg-key delete ABCD1234
```
