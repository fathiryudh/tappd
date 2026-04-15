-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Availability" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "officerId" TEXT NOT NULL,
    "date" DATETIME NOT NULL,
    "status" TEXT NOT NULL,
    "reason" TEXT,
    "rawMessage" TEXT NOT NULL,
    "notes" TEXT,
    "splitDay" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "Availability_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Availability" ("createdAt", "date", "id", "notes", "officerId", "rawMessage", "reason", "status") SELECT "createdAt", "date", "id", "notes", "officerId", "rawMessage", "reason", "status" FROM "Availability";
DROP TABLE "Availability";
ALTER TABLE "new_Availability" RENAME TO "Availability";
CREATE INDEX "Availability_officerId_idx" ON "Availability"("officerId");
CREATE INDEX "Availability_date_idx" ON "Availability"("date");
CREATE UNIQUE INDEX "Availability_officerId_date_key" ON "Availability"("officerId", "date");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;
