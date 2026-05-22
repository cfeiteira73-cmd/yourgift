CREATE TABLE "inventory_alerts" (
  "id" TEXT NOT NULL,
  "variant_id" TEXT NOT NULL,
  "product_id" TEXT NOT NULL,
  "alert_type" TEXT NOT NULL,
  "threshold" INTEGER NOT NULL DEFAULT 10,
  "current_stock" INTEGER NOT NULL,
  "resolved" BOOLEAN NOT NULL DEFAULT false,
  "resolved_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "inventory_alerts_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "inventory_alerts_variant_id_idx" ON "inventory_alerts"("variant_id");
CREATE INDEX "inventory_alerts_resolved_idx" ON "inventory_alerts"("resolved");
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_variant_id_fkey" FOREIGN KEY ("variant_id") REFERENCES "product_variants"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "inventory_alerts" ADD CONSTRAINT "inventory_alerts_product_id_fkey" FOREIGN KEY ("product_id") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
