-- CreateTable
CREATE TABLE "Division" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "name" TEXT NOT NULL
);

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Division_name_key" ON "Division"("name");

-- CreateUniqueIndex
CREATE UNIQUE INDEX "Branch_name_key" ON "Branch"("name");

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
    "divisionId" TEXT,
    "branchId" TEXT,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Officer_divisionId_fkey" FOREIGN KEY ("divisionId") REFERENCES "Division" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Officer_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Officer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Officer" ("adminId", "createdAt", "id", "name", "rank", "role", "telegramId", "telegramName", "updatedAt", "phoneNumber") SELECT "adminId", "createdAt", "id", "name", "rank", "role", "telegramId", "telegramName", "updatedAt", "phoneNumber" FROM "Officer";
DROP TABLE "Officer";
ALTER TABLE "new_Officer" RENAME TO "Officer";
CREATE UNIQUE INDEX "Officer_telegramId_key" ON "Officer"("telegramId");
CREATE UNIQUE INDEX "Officer_phoneNumber_key" ON "Officer"("phoneNumber");
CREATE INDEX "Officer_adminId_idx" ON "Officer"("adminId");
CREATE INDEX "Officer_divisionId_idx" ON "Officer"("divisionId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
