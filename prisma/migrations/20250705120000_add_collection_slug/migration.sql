ALTER TABLE "Collection" ADD COLUMN "slug" TEXT;

UPDATE "Collection" SET "slug" = REPLACE(LOWER(name), ' ', '-');

ALTER TABLE "Collection" ALTER COLUMN "slug" SET NOT NULL;

CREATE UNIQUE INDEX "Collection_slug_key" ON "Collection"("slug");
