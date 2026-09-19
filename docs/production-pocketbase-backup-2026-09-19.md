# VSWorldCup PocketBase backup verification — 2026-09-19

## Scope and outcome

Authorized production access was used to create and validate an on-host PocketBase recovery snapshot. No credential value was printed or copied, and no production record was deleted or modified.

The snapshot was verified by checksum, extracted into an isolated private directory, checked with SQLite, and started with the deployed PocketBase version on a loopback-only temporary listener. Databases and storage files were captured sequentially while the service remained live, so the result is consistent per SQLite database but is not a single point-in-time transaction across every database and storage object.

Exact host identifiers, access paths, service users, kernel/runtime inventory, archive locations, hashes, table counts, row counts, and restore commands are intentionally retained only in the private operational task record rather than this public repository.

## Backup behavior verified

- Every non-empty top-level `*.db` was staged through SQLite's online-backup API.
- Committed WAL content was folded into staged databases.
- Staged databases were normalized to DELETE journal mode.
- Live and staging-generated WAL/SHM sidecars were excluded.
- Empty database placeholders were preserved as ordinary empty files.
- Storage files were staged under a literal `pb_data/` archive root.
- Unsupported source filesystem entries, including symbolic links and special files, fail before publication.
- Archive publication is no-clobber and checksum-last; consumers treat the snapshot as ready only when the adjacent checksum exists and verifies. A destination collision fails closed.
- Resulting files use restrictive permissions in a root-owned backup directory.

## Restore proof

The restore checker:

- binds checksum verification and extraction to the same open archive file;
- requires the expected `pb_data/` directory root;
- rejects traversal, absolute paths, duplicate normalized paths, links, special files, excessive member counts, and excessive expanded size;
- extracts through a private, exclusively created temporary directory;
- validates every non-empty top-level SQLite database with `PRAGMA integrity_check`;
- handles URI metacharacters in database filenames without mutating or bypassing validation;
- claims the final proof directory exclusively; owned failure staging is quarantined and removed through open-descriptor identity checks, while substituted paths are retained for operator inspection.

The restored data passed integrity checks and an isolated PocketBase health check. The temporary process was stopped and its proof directory removed after verification. Production services remained active, and public application/API health checks returned HTTP 200.

## Recovery limitations

The adjacent SHA-256 file detects accidental or unexpected changes relative to the supplied digest; it is not a cryptographic authenticity signature. Quiescing PocketBase remains required when a recovery point must be transactionally aligned across multiple databases and storage files.

The verified snapshot is on-host and therefore does not protect against total host loss. No unapproved external destination, storage account, credential, paid service, recurring schedule, or retention deletion was configured by this work. Off-host replication remains a separately approval-gated operational task.

## Private rollback record

The private Kanban handoff retains the exact archive/checksum identities, restore-test evidence, production inventory, and rollback procedure. Operators must verify that private receipt before any approved restore window; this public document is not a substitute for the environment-specific runbook.
