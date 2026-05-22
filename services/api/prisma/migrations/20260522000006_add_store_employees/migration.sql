-- Migration: add store_employees and employee_orders tables

CREATE TABLE "store_employees" (
  "id"            TEXT NOT NULL,
  "store_id"      TEXT NOT NULL,
  "email"         TEXT NOT NULL,
  "name"          TEXT NOT NULL,
  "department"    TEXT,
  "allowance"     DOUBLE PRECISION NOT NULL DEFAULT 0,
  "spent"         DOUBLE PRECISION NOT NULL DEFAULT 0,
  "is_active"     BOOLEAN NOT NULL DEFAULT true,
  "last_login_at" TIMESTAMP(3),
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at"    TIMESTAMP(3) NOT NULL,
  CONSTRAINT "store_employees_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "store_employees_store_id_email_key"
  ON "store_employees"("store_id", "email");

CREATE INDEX "store_employees_store_id_idx"
  ON "store_employees"("store_id");

ALTER TABLE "store_employees"
  ADD CONSTRAINT "store_employees_store_id_fkey"
  FOREIGN KEY ("store_id")
  REFERENCES "company_stores"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

-- ─────────────────────────────────────────────────────────────

CREATE TABLE "employee_orders" (
  "id"           TEXT NOT NULL,
  "employee_id"  TEXT NOT NULL,
  "store_id"     TEXT NOT NULL,
  "product_id"   TEXT NOT NULL,
  "variant_id"   TEXT,
  "quantity"     INTEGER NOT NULL,
  "total_amount" DOUBLE PRECISION NOT NULL,
  "status"       TEXT NOT NULL DEFAULT 'pending',
  "notes"        TEXT,
  "created_at"   TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "employee_orders_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "employee_orders_employee_id_idx"
  ON "employee_orders"("employee_id");

CREATE INDEX "employee_orders_store_id_idx"
  ON "employee_orders"("store_id");

ALTER TABLE "employee_orders"
  ADD CONSTRAINT "employee_orders_employee_id_fkey"
  FOREIGN KEY ("employee_id")
  REFERENCES "store_employees"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE;
