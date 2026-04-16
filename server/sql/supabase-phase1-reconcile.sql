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
