# Task 2 Audit: Shared Contracts And Type-Like Structures

## Current State

- The repo is mostly JavaScript. There is little static typing, so the effective contracts live in Prisma models, controller logic, and UI assumptions.
- `server/prisma/schema.prisma` is the strongest source of truth:
  - `AvailabilityStatus` is a real enum with `IN` and `OUT`.
  - `Officer` references normalized `Division` and `Branch` tables.
  - `Officer.role` is still a string field even though application logic treats values such as `OFFICER` and `NSF` as enum-like.
- `client/src/api/**` previously forwarded raw axios responses with no local contract declarations.
- `server/src/controllers/**` repeated relation includes and raw response shapes, especially for officers and notifications.

## Inventory In Owned Scope

- `shared/contracts/api.js`
  - Defines shared JSDoc contracts for `NamedRelation`, `AvailabilityRecord`, `Officer`, `OfficerWritePayload`, `OfficerFormOptions`, `NotificationEvent`, `NotificationsPayload`, and `AuthUser`.
  - Exposes the serializer and include helpers the owned controllers rely on.
- `client/src/api/officers.api.js`
  - Imports `Officer`, `OfficerFormOptions`, and `OfficerWritePayload` from the shared contract module.
  - No local duplicate officer typedefs remain in this file.
- `client/src/api/notifications.api.js`
  - Imports `NotificationsPayload` from the shared contract module.
  - Previously kept the read-all acknowledgement as an inline `{ ok: true }` local type.
- `server/src/controllers/officers.controller.js`
  - Uses shared officer serializers and form option selectors.
  - Does not declare its own typedefs, but it is contract-sensitive because it shapes create, list, roster, and form-option responses.
- `server/src/controllers/notifications.controller.js`
  - Uses shared notification payload serialization.
  - Previously returned a raw `{ ok: true }` acknowledgement instead of a shared response contract.
- `server/src/controllers/auth.controller.js`
  - Uses the shared `AuthUser` serializer for login, register, and refresh.
  - Previously returned a raw logout payload with no shared contract.

## Repeated Contracts Found

- Officer response shape:
  - Used by `/officers`, `/officers/roster`, create/update officer responses, and notification event includes.
  - Depends on nested `division` and `branch` objects when relations are present.
- Officer write payload:
  - `phoneNumber` required on create.
  - Optional `name`, `rank`, `role`, `divisionId` or `division`, `branchId` or `branch`.
- Officer form options:
  - `{ divisions: Array<{ id, name }> }`.
- Notification payload:
  - `{ items, unreadCount }`.
- Auth payload:
  - `{ id, email }`.
- Mutation acknowledgement payloads:
  - Notifications read-all used a local `{ ok: true }` contract in the client and controller.
  - Logout used a raw `{ message: 'Logged out' }` payload in the controller with no shared declaration.

## Critical Assessment

- The main problem is contract drift, not the absence of TypeScript by itself.
- Returning raw Prisma objects from multiple endpoints leaves response shape consistency to convention.
- Shared contracts are already in use for the larger response bodies in this slice, which makes the remaining ad hoc acknowledgement payloads stand out as avoidable drift.
- `shared/contracts/api.js` still mixes type declarations, serializer helpers, and include fragments. That coupling is acceptable for this task, but it will become harder to reason about if more endpoint-specific payloads are added without grouping.
- A Prisma enum migration for `Officer.role` would be useful later, but it is not a safe local change for this task because it would affect bot and UI code outside the owned files.

## Recommendations

- Keep Prisma schema as the domain source of truth, but add a shared contract module for API-adjacent shapes.
- Serialize officer, notification, and auth responses through shared helpers instead of returning raw Prisma records directly.
- Expose enum-like values and include fragments centrally so endpoint behavior stays aligned.
- Promote small acknowledgement payloads into the shared contract module as well; they are easy to overlook, but they are still part of the public API surface.
- Defer any refactor that splits `shared/contracts/api.js` by domain until broader ownership is available. The current file is cohesive enough for this slice, and moving symbols around now would create unnecessary merge risk.
- Defer broader static typing and `Officer.role` enum migration until repo-wide ownership is available.

## High-Confidence Changes Applied

- Added shared `ApiSuccessResponse` and `LogoutResponse` typedefs.
- Added `serializeSuccessResponse()` and `serializeLogoutResponse()` so notifications and auth use shared response constructors instead of raw literals.
- Updated `client/src/api/notifications.api.js` to consume the shared success response typedef.
