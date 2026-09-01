-- T6.5 — audit_logs için append-only sertleştirme (manuel, tek seferlik)
-- ŞU ANKİ DURUM: Uygulama Neon owner rolüyle bağlanır; bu SQL manuel uygulanana kadar
-- uygulama seviyesindeki kısıt (API'nin silmemesi, Faz 1/F-09) geçerlidir.
-- HEDEF: Uygulamanın owner yerine kısıtlı bir rolle bağlanması.

-- 1) Salt-ekleme rolleri
CREATE ROLE cerberus_app NOLOGIN;
CREATE ROLE cerberus_audit NOLOGIN PASSWORD 'DEGISTIR-BU-PAROLAYI';

-- 2) App rolüne audit_logs üzerinde UPDATE/DELETE YOK
GRANT SELECT, INSERT ON TABLE audit_logs TO cerberus_audit;
REVOKE UPDATE, DELETE, TRUNCATE ON TABLE audit_logs FROM cerberus_audit;

-- 3) Diğer tablolar tam yetki
GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO cerberus_app;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO cerberus_app;

-- Not: FK'ler ve silme korumaları (T2.2) yetersiz kalan son hattadır;
-- ideal mimaride DATABASE_URL yerine kısıtlı-role bağlantı string'i kullanılır.
-- Geçiş sırası: roller oluştur → uygulama AUDIT_DATABASE_URL ayrı değişkenle bağlanır
-- (küçük kod değişikliği; bu fazın kapsamı dışında bırakılmıştır, Faz 8'e taşınabilir).
