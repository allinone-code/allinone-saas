# CERBERUS — ENTITY RELATIONSHIPS & AUDIT STRATEGY

1. `users.store_code` → `stores.store_code` (Mağaza İzolasyonu & RBAC Zero Trust)
2. `orders.buyer_store` → `stores.store_code` (40-Kolon Google Drive XLS Siparişleri)
3. `orders.psh_batch_no` → `psh_batches.batch_number` (PSH Ön-Envanter Batch Partileri)
4. `product_masters.researcher_code` → `researchers.code` (10 Kişilik ABD Sourcing Ekibi Atfı)
5. `audit_logs` → Bütün kritik mutasyonları (`WHO • WHAT • WHEN • BEFORE • AFTER • EVIDENCE`) saklar.
