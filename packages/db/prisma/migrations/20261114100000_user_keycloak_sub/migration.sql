-- AlterTable
ALTER TABLE "users" ALTER COLUMN "entraOid" DROP NOT NULL;

-- AlterTable
ALTER TABLE "users" ADD COLUMN "keycloakSub" VARCHAR(255);

-- CreateIndex
CREATE UNIQUE INDEX "users_keycloakSub_key" ON "users"("keycloakSub");
