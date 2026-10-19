-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_Deadline" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "caseId" TEXT NOT NULL,
    "key" TEXT NOT NULL DEFAULT '',
    "title" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'suggested',
    "date" DATETIME,
    "note" TEXT,
    "verified" BOOLEAN NOT NULL DEFAULT false,
    "sourceJson" TEXT,
    "triggerJson" TEXT,
    CONSTRAINT "Deadline_caseId_fkey" FOREIGN KEY ("caseId") REFERENCES "Case" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);
INSERT INTO "new_Deadline" ("caseId", "date", "id", "note", "title", "verified") SELECT "caseId", "date", "id", "note", "title", "verified" FROM "Deadline";
DROP TABLE "Deadline";
ALTER TABLE "new_Deadline" RENAME TO "Deadline";
CREATE INDEX "Deadline_caseId_idx" ON "Deadline"("caseId");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

