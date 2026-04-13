-- CreateEnum
CREATE TYPE "AvailabilityStatus" AS ENUM ('AVAILABLE', 'UNAVAILABLE', 'MC', 'ON_LEAVE', 'DUTY', 'UNKNOWN');

-- CreateTable
CREATE TABLE "Officer" (
    "id" TEXT NOT NULL,
    "telegramId" TEXT NOT NULL,
    "telegramName" TEXT,
    "name" TEXT,
    "rank" TEXT,
    "adminId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Officer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Availability" (
    "id" TEXT NOT NULL,
    "officerId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "status" "AvailabilityStatus" NOT NULL,
    "rawMessage" TEXT NOT NULL,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Availability_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Officer_telegramId_key" ON "Officer"("telegramId");

-- CreateIndex
CREATE INDEX "Officer_adminId_idx" ON "Officer"("adminId");

-- CreateIndex
CREATE INDEX "Availability_officerId_idx" ON "Availability"("officerId");

-- CreateIndex
CREATE INDEX "Availability_date_idx" ON "Availability"("date");

-- CreateIndex
CREATE UNIQUE INDEX "Availability_officerId_date_key" ON "Availability"("officerId", "date");

-- AddForeignKey
ALTER TABLE "Officer" ADD CONSTRAINT "Officer_adminId_fkey" FOREIGN KEY ("adminId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Availability" ADD CONSTRAINT "Availability_officerId_fkey" FOREIGN KEY ("officerId") REFERENCES "Officer"("id") ON DELETE CASCADE ON UPDATE CASCADE;
