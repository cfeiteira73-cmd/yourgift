CREATE TABLE "allowance_ledger" (
  "id" TEXT NOT NULL,
  "employee_id" TEXT NOT NULL,
  "store_id" TEXT NOT NULL,
  "amount" DOUBLE PRECISION NOT NULL,
  "balance" DOUBLE PRECISION NOT NULL,
  "entry_type" TEXT NOT NULL,
  "reference_id" TEXT,
  "description" TEXT NOT NULL,
  "actor_id" TEXT,
  "actor_type" TEXT,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "allowance_ledger_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "allowance_ledger_employee_id_created_at_idx" ON "allowance_ledger"("employee_id", "created_at");
CREATE INDEX "allowance_ledger_store_id_idx" ON "allowance_ledger"("store_id");
ALTER TABLE "allowance_ledger" ADD CONSTRAINT "allowance_ledger_employee_id_fkey" FOREIGN KEY ("employee_id") REFERENCES "store_employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
