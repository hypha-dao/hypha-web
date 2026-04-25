# ADR 0001 — Voice and video recording pipeline and space media storage

## Status

Accepted (normative for product implementation in this repository).

## 1) Recording and transcription pipeline

**Matrix `GroupCall`** does not by itself provide durable server-side recording or speech-to-text for “world-class” org memory.

**Decision (primary):** Use an **external SFU** (e.g. LiveKit or a vendor) with **egress** to object storage, then **async STT**; correlate rows with a **`call_session_id`** (see implementation spec and `useSpaceGroupCall`).

**Decision (non-default):** **Client-side** capture and upload is **not** the default product path; it may exist for narrow cases but is not the reference architecture.

## 2) Space media storage (normative)

Space-scoped media (call recording blobs, related uploads) must be stored in a way that is **stable, auditable, and independent** of third-party tool URLs or agent branches.

**Decision:** Implementations **SHALL** treat the following as authoritative for **physical** (blob) and **read URL** handling:

1. **Scoping** — Object keys or paths are **hierarchical** under a space identifier the app already uses in persistence (e.g. `space_id` or canonical slug) so deletion and access can be tied to `spaces` rows.
2. **Durability** — **Binary** payload lives in **object storage** (S3-compatible or product-chosen). Application DB rows store **metadata** and **pointers** (`storage_key` and/or `https` `media_uri`), not large blobs, unless product explicitly approves an alternative.
3. **Encryption** — Data is **encrypted at rest** in object storage. Client uploads use **time-limited signed URLs** or an equivalent authenticated API that does not expose long-lived public write access.
4. **Read access** — End users receive **time-limited signed GET URLs** (or same-origin proxy) for playback/download; **no** unauthenticated public URLs for private Space content without an explicit product decision and threat review.
5. **Schema alignment** — `space_call_recordings` (and similar tables) use **FK** to `spaces` and a stable **`call_session_id`**. Ingest API field names **SHALL** match the Drizzle schema at merge time.

**Database linkage** to `thread_root_event_id` or Matrix ids remains **contextual** and is defined in the voice/video implementation spec.

## Reconciliation

When an external or exploratory write-up (for example, a design thread on a private tool) uses different field names or path templates, that document is **informational**: implementers port the **intended** behavior into this ADR and the `storage-postgres` schema, then update code. The repo **does not** depend on external URLs for normative requirements.

## Consequences

- CI and reviews can gate implementation against this file and the schema, not against mutable links.
- Future changes to the SFU vendor, bucket layout, or URL policy are **one ADR amend** or a successor ADR.

## References

- `docs/requirements/voice-video-call-implementation-spec.md` — call artifact and memory UX.
- `docs/requirements/voice-video-call-implementation-plan.md` — phased delivery and traceability.
