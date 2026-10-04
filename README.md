# Shift Distributor

Doctor duty, department, night-shift and vacation planning with German frontend labels. Built with Next.js 16, React 19, TypeScript, React Query and Drizzle/SQLite.

## Development

The locked Nix flake provides Node **24.21.0** and the native build tools needed by `better-sqlite3`. Docker uses the same Node version. npm and `package-lock.json` are the only package-manager workflow.

```sh
nix develop
npm ci
cp .env.example .env.local
# Set JWT_SECRET to a long random value in .env.local.
npm run db:migrate
npm run dev
```

Commands can also run directly with `nix develop --command npm <command>`. Do not use a system Node installation for dependencies: native SQLite bindings must match the flake's Node ABI. If dependencies were installed with another Node version, run `npm ci` inside the flake again.

`DATABASE_PATH` defaults to `./data/sqlite.db`. Application startup reads `.env.local`; migration and restore scripts also load the Next.js environment files. `MOCK_EMAIL_FOLDER` writes email previews and MIME messages locally instead of sending SMTP mail. Configure `SMTP_HOST`, `SMTP_PORT`, `SMTP_SECURE`, `SMTP_USER`, `SMTP_PASS` and `SMTP_FROM` only when real delivery is intended.

```sh
npm run check        # ESLint, TypeScript, regression tests and production build
npm run db:generate # Generate a migration after changing schema.ts
npm run db:migrate  # Apply committed migrations; safe to repeat
npm run db:studio   # Inspect the selected database
```

Use committed migrations for persisted data. `db:push` is an exploratory tool for disposable databases and bypasses the migration history.

## Testing the Hetzner copy

The production database was copied through SQLite's online backup API while the service remained running. The original local backup is read-only:

- `data/backups/hetzner-20261003T205713Z.sqlite`
- SHA-256: `539b4a15b62f0d60b647cf4dc6e4ca5ab5f225dac5f5cf18a7a74918112fcc5e`

The migrated working copy is `data/review/sqlite.db`. Local `.env.local` selects this copy and `data/review/mock-emails`; existing production accounts and passwords remain usable locally. Backups, working databases, email output and environment secrets are excluded from Git and Docker build contexts.

To create another disposable copy, stop any process using the target and choose a new, nonexistent path:

```sh
nix develop --command npm run db:restore -- data/backups/hetzner-20261003T205713Z.sqlite data/review-second/sqlite.db
DATABASE_PATH=./data/review-second/sqlite.db nix develop --command npm run db:migrate
DATABASE_PATH=./data/review-second/sqlite.db MOCK_EMAIL_FOLDER=./data/review-second/mock-emails nix develop --command npm run dev
```

Restore refuses to overwrite an existing file. Migrations preserve old migration records, run each new migration transactionally and check SQLite integrity and foreign keys. The legacy-data migration normalizes double-encoded doctor settings, merges duplicate assignments by doctor ID, renames `INT-1/2` to `ITS-1/2`, folds `ND` into `night`, and removes empty `ND-frei` rows. Existing vacations retain their IDs and approval status; only new or recategorized entries start pending.

## Refactor review and architecture

The original maintenance risks were duplicated scheduling rules, annual delete-and-reinsert vacation writes, mirrored query/local state, incomplete cache invalidation, independent night-shift APIs, and migration repair mixed into container startup. The refactor puts each responsibility behind a shared boundary:

| Responsibility | Location | How to extend it |
| --- | --- | --- |
| Domain DTOs and API errors | `src/lib/contracts.ts`, `src/lib/api-error.ts` | Change transport contracts without importing browser fetch code into server modules. |
| Dates, Hesse holidays and assignment conflicts | `src/lib/dates.ts`, `holidays.ts`, `scheduling-rules.ts` | Add a rule once; calendars, selectors and the scheduler share it. Match absences by doctor ID. |
| Duty IDs and German labels | `src/lib/shifts.ts` | Keep stable stored IDs separate from display labels. Department IDs are explicit. |
| Distribution | `src/lib/scheduler.ts` | Pure scheduling with an injectable random source; test rules without React or SQLite. |
| Assignment persistence | `src/lib/server/assignment-service.ts` | Validate and write batches atomically; use expected versions to reject stale edits. |
| Vacation edits and decisions | `src/lib/server/vacation-service.ts` | Apply granular edits, quotas and approval transitions transactionally; preserve unchanged records. |
| Server state | `src/lib/query-keys.ts`, feature query/mutation hooks | Keep one React Query cache; invalidate monthly and annual schedules together. |
| Calendar interaction | `components/calendar/useCalendarSelection.ts`, `use-anchored-overlay.ts` | Model selection/edit/save transitions explicitly; reuse overlay positioning. |
| Annual rendering | `components/vacations/`, `components/night-shifts/` | Keep calendar/pill rendering separate from page orchestration and persistence. |
| Email rendering, delivery and planning | `src/lib/server/calendar-email-*.ts`, `month-calendar-emails.ts` | Test formatting independently; preview a consistent database snapshot before sending. |
| Migration and restore operations | `scripts/migrate.cjs`, `scripts/restore.cjs` | Apply the journal explicitly and restore only to new working files. |

API routes authenticate, parse inputs and delegate mutations to domain services. Database constraints enforce unique assignment slots and absence dates. Assignment versions return HTTP 409 when another editor has changed a slot. Clients preserve the editor on failed saves so users can review or retry.

New doctor vacation entries require secretary approval. A category change returns an entry to pending; editing an unchanged entry preserves its approval. Approval and denial notifications are written atomically and repeated decisions do not duplicate notifications. Approved absences participate in planning conflicts; planners can still make explicit manual overrides after reviewing warnings.

Unpublished months are filtered on the server for doctors in both the monthly calendar and annual night-shift view. Missing publication records retain the legacy published behavior. Planners and secretaries retain the visibility needed for their roles.

Authentication changes cancel and clear server-state queries. Generation checks prevent late responses or optimistic rollbacks from restoring a previous account's cached data.

Both spreadsheet exports use ExcelJS with its real types. Calendar attachments use escaped, UTF-8-folded iCalendar lines and exclusive all-day end dates. Email sends require the current preview revision and keep a per-recipient delivery ledger, so repeating a successful request does not resend it. An interrupted or ambiguous SMTP attempt stays `sending` or `uncertain`; inspect the SMTP provider before manually clearing that exact ledger entry for a retry. Mock delivery failures can retry automatically.

Keep future work within these boundaries: add domain rules with focused tests, use granular/versioned writes, and compose UI sections into feature components. Avoid a generic framework for the different annual views; their approval and assignment interactions have different responsibilities.

## Validation and dependency status

Regression tests cover fresh and legacy migrations, historical data preservation, atomic rollback, concurrent assignment versions, vacation quotas and decisions, role permissions, publication filtering, email revision/retry behavior, date rules, scheduling, cache invalidation, selection state and iCalendar formatting. Browser checks use a separate synthetic database; review data remains available for manual acceptance testing.

Production dependencies currently have no reported npm audit vulnerabilities. The development lint chain still reports the upstream `braces` stack-exhaustion advisory through `eslint-config-next` (five affected dependency entries). The suggested downgrade to Next 14's lint configuration is incompatible with this toolchain; recheck when an upstream fix is released. React Compiler is not enabled, so its `refs` and `set-state-in-effect` lint rules are disabled while standard Hooks rules remain active.

## Docker / Hetzner

```sh
docker compose -f docker-compose.prod.yml build
docker compose -f docker-compose.prod.yml up -d
```

The image builds from the npm lockfile, serves the Next.js standalone output as the unprivileged `node` user (UID/GID 1000), and runs committed migrations before starting. Compose reads `.env`, binds port 3069 and persists `./data`. The mounted directory must be writable by UID/GID 1000; verify this before replacing an older root-run container.

The deployment checkout is `/home/infiniter/services/shift-distributor` on Hetzner. This refactor has **not** been deployed. Before a later deployment, take another SQLite online backup, test migrations against a copy and verify the local acceptance flows. To roll back after a schema migration, stop the application and restore the matching pre-deployment database together with the old application image; do not run an older image against the migrated schema.
