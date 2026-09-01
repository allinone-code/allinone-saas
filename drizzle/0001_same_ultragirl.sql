CREATE INDEX "product_masters_asin_idx" ON "product_masters" USING btree ("asin");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_quantity_positive" CHECK ("orders"."quantity" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_pack_count_positive" CHECK ("orders"."pack_count" > 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_unit_cost_non_negative" CHECK ("orders"."unit_cost" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_selling_price_non_negative" CHECK ("orders"."selling_price" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_total_cost_non_negative" CHECK ("orders"."total_cost" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_refund_non_negative" CHECK ("orders"."refund_amount" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fire_qty_non_negative" CHECK (
    "orders"."p1_cancel_qty" >= 0 and "orders"."p2_missing_qty" >= 0
    and "orders"."p3_defective_qty" >= 0 and "orders"."p4_expired_qty" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_non_negative" CHECK ("orders"."shipped_to_amazon" >= 0);--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_shipped_within_quantity" CHECK ("orders"."shipped_to_amazon" <= "orders"."quantity");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fire_within_quantity" CHECK (
    "orders"."p1_cancel_qty" + "orders"."p2_missing_qty" + "orders"."p3_defective_qty" + "orders"."p4_expired_qty"
    <= "orders"."quantity");--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_cargo_status_enum" CHECK ("orders"."cargo_status" in
    ('Yolda', 'Tam Geldi', 'İPTAL', 'Kayıp Depoya gelmiş'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_psh_status_enum" CHECK ("orders"."psh_status" in
    ('BEKLIYOR', 'BATCH_OLUSTURULDU', 'DEPO_SAYILDI', 'AMAZONA_SEVK'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_inventory_lab_status_enum" CHECK ("orders"."inventory_lab_status" in
    ('GIRILMEDI', 'GIRILDI', 'AKTIF_SATISTA'));--> statement-breakpoint
ALTER TABLE "orders" ADD CONSTRAINT "orders_fulfillment_type_enum" CHECK ("orders"."fulfillment_type" in ('FBA', 'FBM'));--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_prices_non_negative" CHECK (
    "product_masters"."source_price" >= 0 and "product_masters"."landed_cost" >= 0 and "product_masters"."selling_price" >= 0);--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_scores_in_range" CHECK (
    "product_masters"."confidence_score" between 0 and 100
    and "product_masters"."opportunity_score" between 0 and 100
    and "product_masters"."profitability_score" between 0 and 100
    and "product_masters"."demand_score" between 0 and 100
    and "product_masters"."competition_score" between 0 and 100
    and "product_masters"."price_stability_score" between 0 and 100
    and "product_masters"."supplier_risk_score" between 0 and 100
    and "product_masters"."operational_risk_score" between 0 and 100);--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_duplicate_score_in_range" CHECK ("product_masters"."duplicate_score" between 0 and 100);--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_decision_action_enum" CHECK ("product_masters"."decision_action" in
    ('BUY', 'TEST', 'WAIT', 'REJECT', 'REPRICE', 'REORDER', 'PAUSE', 'LIQUIDATE'));--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_risk_level_enum" CHECK ("product_masters"."risk_level" in
    ('LOW', 'MEDIUM', 'HIGH', 'CRITICAL'));--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_policy_status_enum" CHECK ("product_masters"."policy_status" in
    ('APPROVED_BY_POLICY', 'REQUIRES_MANAGER_APPROVAL', 'FLAGGED_IP_RISK'));--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_freshness_enum" CHECK ("product_masters"."data_freshness_status" in
    ('FRESH', 'AGING', 'STALE', 'EXPIRED'));--> statement-breakpoint
ALTER TABLE "product_masters" ADD CONSTRAINT "pm_quality_enum" CHECK ("product_masters"."data_quality_status" in
    ('VALID', 'INVALID', 'MISSING', 'STALE', 'CONFLICTING'));