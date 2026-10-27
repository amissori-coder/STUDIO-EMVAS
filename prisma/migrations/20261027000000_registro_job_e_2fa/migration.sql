-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "nome" TEXT NOT NULL,
    "startedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" DATETIME,
    "esito" TEXT,
    "dettagli" TEXT,
    "origine" TEXT NOT NULL
);

-- RedefineTables
PRAGMA defer_foreign_keys=ON;
PRAGMA foreign_keys=OFF;
CREATE TABLE "new_User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "email" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "passwordHash" TEXT,
    "ruolo" TEXT NOT NULL,
    "attivo" BOOLEAN NOT NULL DEFAULT true,
    "colore" TEXT NOT NULL DEFAULT '#2563eb',
    "telefono" TEXT,
    "notificaEmail" BOOLEAN NOT NULL DEFAULT true,
    "notificaPush" BOOLEAN NOT NULL DEFAULT true,
    "inviteToken" TEXT,
    "inviteExpires" DATETIME,
    "lastLoginAt" DATETIME,
    "sessionVersion" INTEGER NOT NULL DEFAULT 0,
    "totpSecret" TEXT,
    "totpAttivo" BOOLEAN NOT NULL DEFAULT false,
    "totpRecupero" TEXT,
    "totpConfermato" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);
INSERT INTO "new_User" ("attivo", "colore", "createdAt", "email", "id", "inviteExpires", "inviteToken", "lastLoginAt", "nome", "notificaEmail", "notificaPush", "passwordHash", "ruolo", "sessionVersion", "telefono", "updatedAt") SELECT "attivo", "colore", "createdAt", "email", "id", "inviteExpires", "inviteToken", "lastLoginAt", "nome", "notificaEmail", "notificaPush", "passwordHash", "ruolo", "sessionVersion", "telefono", "updatedAt" FROM "User";
DROP TABLE "User";
ALTER TABLE "new_User" RENAME TO "User";
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "User_inviteToken_key" ON "User"("inviteToken");
PRAGMA foreign_keys=ON;
PRAGMA defer_foreign_keys=OFF;

-- CreateIndex
CREATE INDEX "JobRun_nome_startedAt_idx" ON "JobRun"("nome", "startedAt");

-- CreateIndex
CREATE INDEX "JobRun_startedAt_idx" ON "JobRun"("startedAt");

