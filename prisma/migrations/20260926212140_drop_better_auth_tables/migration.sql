-- Drop the two Better Auth tables: the dependency was removed and nothing reads them.
-- `account` held one vestigial credential row from the initial setup, `verification` was empty.
-- Matches `prisma migrate diff --from-config-datasource --to-schema prisma/schema.prisma`.
-- DropForeignKey
ALTER TABLE "account" DROP CONSTRAINT "account_userId_fkey";
-- DropTable
DROP TABLE "account";
-- DropTable
DROP TABLE "verification";
