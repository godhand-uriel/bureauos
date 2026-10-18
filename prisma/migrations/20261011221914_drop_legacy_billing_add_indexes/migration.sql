-- DropIndex
DROP INDEX "DisclaimerAcceptance_userId_version_idx";

-- DropIndex
DROP INDEX "Subscription_userId_key";

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Payment";
PRAGMA foreign_keys=on;

-- DropTable
PRAGMA foreign_keys=off;
DROP TABLE "Subscription";
PRAGMA foreign_keys=on;

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL DEFAULT '',
    "role" TEXT NOT NULL DEFAULT 'customer',
    "mfaSecret" TEXT NOT NULL DEFAULT '',
    "mfaEnabled" BOOLEAN NOT NULL DEFAULT false,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "usState" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);
INSERT INTO "new_User" ("createdAt", "email", "id", "mfaEnabled", "mfaSecret", "name", "passwordHash", "phone", "role", "usState") SELECT "createdAt", "email", "id", "mfaEnabled", "mfaSecret", "name", "passwordHash", "phone", "role", "usState" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "AdminNote_caseId_idx" ON "AdminNote"("caseId");

-- CreateIndex
CREATE INDEX "AdminNote_ticketId_idx" ON "AdminNote"("ticketId");

-- CreateIndex
CREATE INDEX "AdminNote_reviewId_idx" ON "AdminNote"("reviewId");

-- CreateIndex
CREATE INDEX "DisclaimerAcceptance_userId_caseId_version_idx" ON "DisclaimerAcceptance"("userId", "caseId", "version");

-- CreateIndex
CREATE INDEX "TicketMessage_ticketId_idx" ON "TicketMessage"("ticketId");

