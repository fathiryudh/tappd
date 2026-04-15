/*
  Warnings:

  - You are about to drop the column `department` on the `Officer` table. All the data in the column will be lost.
  - Added the required column `phoneNumber` to the `Officer` table without a default value. This is not possible if the table is not empty.

*/
-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Officer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT,
    "telegramName" TEXT,
    "phoneNumber" TEXT NOT NULL,
    "name" TEXT,
    "rank" TEXT,
    "role" TEXT NOT NULL DEFAULT 'OFFICER',
    "division" TEXT,
    "branch" TEXT,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Officer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Officer" ("adminId", "createdAt", "id", "name", "rank", "telegramId", "telegramName", "updatedAt", "phoneNumber") SELECT "adminId", "createdAt", "id", "name", "rank", "telegramId", "telegramName", "updatedAt", 'MIGRATE_' || "telegramId" FROM "Officer";
DROP TABLE "Officer";
ALTER TABLE "new_Officer" RENAME TO "Officer";
CREATE UNIQUE INDEX "Officer_telegramId_key" ON "Officer"("telegramId");
CREATE UNIQUE INDEX "Officer_phoneNumber_key" ON "Officer"("phoneNumber");
CREATE INDEX "Officer_adminId_idx" ON "Officer"("adminId");
CREATE INDEX "Officer_division_idx" ON "Officer"("division");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
