-- İçe aktarma esnekliği (import-xls) — 4 gereksinim tek migration'da:
--
-- 1) Kargo durumu SERBEST METİN olur:
--    `orders_cargo_status_enum` CHECK kısıtı kaldırılır. Kargo firmalarının
--    XLS'e serbest yazabildiği bu alanda enum'a zorlamak içe aktarımda
--    satır kaybına yol açıyordu. Eski değerler ('Yolda', 'Tam Geldi',
--    'İPTAL', 'Kayıp Depoya gelmiş') aynen geçerlidir; yeni değerler de
--    kabul edilir.
--
-- 2) Aynı order number altında FARKLI ASIN'lere izin verilir:
--    Eski UNIQUE(order_number, buyer_store) kısıtı tek siparişte birden
--    çok ürün satın alınmasını engelliyordu. Mükerrerlik koruması artık
--    UNIQUE(order_number, buyer_store, asin) üçlüsündedir.
--
-- GÜVENLİK NOTU: Yeni index eskisinden DAHA gevşektir; (order_number,
-- buyer_store) ikilisinde benzersiz olan her veri kümesi üçlü benzersizliğini
-- de sağlar. Bu yüzden ön temizlik (dedupe) gerekmez.
ALTER TABLE "orders" DROP CONSTRAINT "orders_cargo_status_enum";--> statement-breakpoint
DROP INDEX "orders_order_number_store_uq";--> statement-breakpoint
CREATE UNIQUE INDEX "orders_order_number_store_asin_uq" ON "orders" USING btree ("order_number","buyer_store","asin");
