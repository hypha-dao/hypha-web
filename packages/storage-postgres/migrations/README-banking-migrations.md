# Banking migrations (0049–0053)

These migrations ship together on the banking feature branch (Steps 1–3). If **none** of them have been applied in an environment yet, you may squash them into a single `0049_banking.sql` before merging to `main` for a cleaner history (omit `admin_person_id` on `bank_customers`).

| File | Purpose |
|------|---------|
| `0049_bank_customers.sql` | KYB customer row per space |
| `0050_bank_virtual_accounts.sql` | Permanent virtual accounts |
| `0051_bank_transfers.sql` | One-time transfer requests |
| `0052_banking_pending_operations.sql` | Nullable Bridge IDs for pending KYB / manual activation |
| `0053_drop_bank_customer_admin_person.sql` | Remove unused `admin_person_id` |

After merge to `main`, do **not** renumber applied migrations.
