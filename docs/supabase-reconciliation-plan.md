# Supabase Reconciliation Plan

Date: 2026-04-16

## Live introspection summary

Live Supabase schema was introspected through the shared pooler:

- Host: `aws-1-ap-southeast-1.pooler.supabase.com`
- Database: `postgres`
- Project ref: `kmlrneyhpozpklkulgbt`

Live `public` tables found:

- `Availability`
- `Officer`
- `Task`
- `User`

Live row counts at inspection time:

- `User`: 1
- `Officer`: 1
- `Availability`: 10
- `Task`: 0

## Diff against `server/prisma/schema.prisma`

### Missing tables in Supabase

- `Division`
- `Branch`
- `NotificationEvent`

### Extra legacy tables in Supabase

- `Task`

Keep `Task` for now. It is legacy but empty and dropping it is not required for initial reconciliation.

### `Officer` mismatches

Missing columns in Supabase:

- `phoneNumber String @unique`
- `role String @default("OFFICER")`
- `divisionId String?`
- `branchId String?`

Nullability / FK mismatches:

- `telegramId` is `NOT NULL` in Supabase, nullable in Prisma
- `adminId` is `NOT NULL` in Supabase, nullable in Prisma
- `adminId` FK is `ON DELETE CASCADE` in Supabase, `ON DELETE SET NULL` in Prisma

Missing indexes / relations:

- `Officer_phoneNumber_key`
- `Officer_divisionId_idx`
- `Officer_divisionId_fkey`
- `Officer_branchId_fkey`

### `Availability` mismatches

- `date` is `date` in Supabase, `DateTime` in Prisma
- `splitDay Boolean @default(false)` is missing in Supabase

Matched items:

- `AvailabilityStatus` enum values are already `IN`, `OUT`
- unique index on `("officerId", "date")` exists
- FK to `Officer(id)` already uses `ON DELETE CASCADE`

### `NotificationEvent` mismatches

The whole table is missing in Supabase:

- columns
- indexes
- FKs to `User` and `Officer`

### `Division` / `Branch` normalization

The live `Officer` table has neither the old `department` column nor the new `divisionId` / `branchId` columns. There is no live department data to migrate from the current inspected schema.

## Applied on Supabase

Phase 1 was applied live on 2026-04-16.

Applied successfully:

- created `Division`
- created `Branch`
- created `NotificationEvent`
- added `Officer.phoneNumber`
- added `Officer.role`
- added `Officer.divisionId`
- added `Officer.branchId`
- relaxed `Officer.telegramId` to nullable
- relaxed `Officer.adminId` to nullable
- changed `Officer.adminId` FK to `ON DELETE SET NULL`
- added `Availability.splitDay`
- converted `Availability.date` from `date` to `timestamp without time zone`
- added supporting indexes and FKs for `Division`, `Branch`, and `NotificationEvent`

## Safety assessment

Current status after Phase 2: `SAFE TO DEPLOY`

Reason:

- `Officer.phoneNumber` has been backfilled for the live officer row and the column is now `NOT NULL`.
- The remaining extra `Task` table is legacy and empty. It is not referenced by the current Prisma schema and is not a blocker for Render deployment.

## Safe non-destructive migration plan

### Phase 1: safe additive / relaxing changes

Status: completed

These changes are non-destructive and can be applied without deleting data:

```sql
create table if not exists "Division" (
  "id" text primary key,
  "name" text not null unique
);

create table if not exists "Branch" (
  "id" text primary key,
  "name" text not null unique
);

alter table "Officer"
  add column if not exists "phoneNumber" text,
  add column if not exists "role" text not null default 'OFFICER',
  add column if not exists "divisionId" text,
  add column if not exists "branchId" text;

alter table "Officer"
  alter column "telegramId" drop not null,
  alter column "adminId" drop not null;

create unique index if not exists "Officer_phoneNumber_key" on "Officer" ("phoneNumber");
create index if not exists "Officer_divisionId_idx" on "Officer" ("divisionId");

alter table "Availability"
  add column if not exists "splitDay" boolean not null default false;

alter table "Availability"
  alter column "date" type timestamp(3) without time zone
  using "date"::timestamp without time zone;

create table if not exists "NotificationEvent" (
  "id" text primary key,
  "adminId" text not null,
  "officerId" text not null,
  "title" text not null,
  "message" text not null,
  "eventDate" timestamp(3) without time zone not null,
  "readAt" timestamp(3) without time zone,
  "createdAt" timestamp(3) without time zone not null default current_timestamp
);

create index if not exists "NotificationEvent_adminId_createdAt_idx" on "NotificationEvent" ("adminId", "createdAt");
create index if not exists "NotificationEvent_adminId_readAt_idx" on "NotificationEvent" ("adminId", "readAt");
create index if not exists "NotificationEvent_officerId_idx" on "NotificationEvent" ("officerId");
```

Then reconcile foreign keys:

```sql
alter table "Officer" drop constraint if exists "Officer_adminId_fkey";

alter table "Officer"
  add constraint "Officer_adminId_fkey"
  foreign key ("adminId") references "User"("id")
  on delete set null
  on update cascade;

alter table "Officer" drop constraint if exists "Officer_divisionId_fkey";
alter table "Officer"
  add constraint "Officer_divisionId_fkey"
  foreign key ("divisionId") references "Division"("id")
  on delete set null
  on update cascade;

alter table "Officer" drop constraint if exists "Officer_branchId_fkey";
alter table "Officer"
  add constraint "Officer_branchId_fkey"
  foreign key ("branchId") references "Branch"("id")
  on delete set null
  on update cascade;

alter table "NotificationEvent" drop constraint if exists "NotificationEvent_adminId_fkey";
alter table "NotificationEvent"
  add constraint "NotificationEvent_adminId_fkey"
  foreign key ("adminId") references "User"("id")
  on delete cascade
  on update cascade;

alter table "NotificationEvent" drop constraint if exists "NotificationEvent_officerId_fkey";
alter table "NotificationEvent"
  add constraint "NotificationEvent_officerId_fkey"
  foreign key ("officerId") references "Officer"("id")
  on delete cascade
  on update cascade;
```

### Phase 2: manual data backfill required

Status: completed

This is the only unresolved blocker before full alignment:

Completed actions:

```sql
update "Officer"
set "phoneNumber" = '<real phone number>'
where "phoneNumber" is null;

alter table "Officer"
  alter column "phoneNumber" set not null;
```

### Phase 3: verification

Status: completed

After phase 1 and phase 2:

1. Run `prisma db pull` again against Supabase.
2. Confirm only expected differences remain, ideally none except legacy `Task`.
3. Start the server against Supabase and rerun tests.
4. Confirm officer create/update flows populate `phoneNumber`.
5. Only then treat Render deployment as safe.

## Notes

- The checked-in Prisma migrations under `server/prisma/migrations` are SQLite-era and must not be applied to Supabase.
- The live `Task` table is currently empty. Leave it in place until the app is fully stable on Supabase, then remove it in a separately approved cleanup step.
