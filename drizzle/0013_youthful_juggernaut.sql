-- token_encrypted: bookmarklet kurulum token'ı artık AES-256-GCM ile ŞİFRELENİ
-- saklanıyor. Neden: düz metin saklanırsa kullanıcı bookmarklet'ini sayfayı
-- kapattıktan sonra da görebilir; hash-only saklanırsa herkes "yenile"ye basar
-- ve ekipteki 10 kişi birbirinin bookmarklet'ini geçersiz kılar.
--
-- `DEFAULT ''` bilinçli: NOT NULL kolon mevcut satırlara varsayılan vermeden
-- eklenirse, tabloda tek bir satır varsa migration PATLAR. Boş string geçerli
-- bir şifreli değer değildir — `decryptToken('')` null döner ve kod token'ı
-- yeniden üretir. Yani güvenli şekilde "bilinmiyor" anlamına gelir.
ALTER TABLE "crawler_capture_tokens" ADD COLUMN "token_encrypted" text NOT NULL DEFAULT '';
