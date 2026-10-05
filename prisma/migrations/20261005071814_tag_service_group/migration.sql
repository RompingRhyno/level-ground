-- The service a tag sits under (a service slug). Tags are the specific covers a project earned and
-- services are the categories above them, so this column is what lets a service page or the gallery
-- picker gather its covers. Nullable: a tag need not belong to a service.
-- See docs/services-revamp-plan.md and docs/services-revamp-tags.csv.
ALTER TABLE "Tag" ADD COLUMN     "service" TEXT;

-- CreateIndex
CREATE INDEX "Tag_service_idx" ON "Tag"("service");
