-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Officer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "telegramId" TEXT NOT NULL,
    "telegramName" TEXT,
    "name" TEXT,
    "rank" TEXT,
    "department" TEXT,
    "adminId" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Officer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);
INSERT INTO "new_Officer" ("adminId", "createdAt", "department", "id", "name", "rank", "telegramId", "telegramName", "updatedAt") SELECT "adminId", "createdAt", "department", "id", "name", "rank", "telegramId", "telegramName", "updatedAt" FROM "Officer";
DROP TABLE "Officer";
ALTER TABLE "new_Officer" RENAME TO "Officer";
CREATE UNIQUE INDEX "Officer_telegramId_key" ON "Officer"("telegramId");
CREATE INDEX "Officer_adminId_idx" ON "Officer"("adminId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
