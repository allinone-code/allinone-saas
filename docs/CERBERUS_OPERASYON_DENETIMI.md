# Cerberus Trading — Operasyon Denetimi ve Otomasyon Planı

Hazırlanma: 2026-10-22 · Kaynak: `Cerberus_Yedek_21Ags.xlsx` (Sat26 194 veri satırı) ve `Cerberus_Den_Rapor2026.xlsx`.
Her sayı dosyalardan **ölçülmüştür** (formül + önbellek değeri, ham XML). Ölçülmeyen her şey **Varsayım** diye işaretlidir.

> **Önemli not (dosya tarifi ile gerçek fark):** Den_Rapor'da `iLabKar`, `AmazonKar`, `AsinKar`, `Receipt`, `PSH1016`, `Excel&Ilab` sayfaları **var** (tarifte "eksik" demiştin). `Excel&PSH` ve `Excel&Amazon` Yedek'te değil, **Den_Rapor'da**. `Excel&PSH` Yedek'te yok.

---

## A) R1–R12 Doğrulama

Durum: ✅ doğrulandı · ⚠️ kısmen / farklı biçimde · ❌ dosyada kanıt yok.

| # | Durum | Kanıt (dosya!hücre) | Düzeltme |
|---|---|---|---|
| R1 Depo26 formül kayması | ⚠️ | Yedek `Depo26!B2:X195` her satır `Sat26` aynı satırına doğrudan bağlı (194/194 fark 0 — şu an **kaymamış**). Ama **Depo26!B196:X1307 = 1.112 satır × 17 kolon = 18.904 `#REF!`**: Sat26'dan satır silinmiş. Satır konumuna bağlı formül, Sat26'da sırala/filtrele/sil yapınca kayar. | Depo26'yı kaldır; SQL view (C2). Geçici: `INDEX/MATCH` ile Orderno+ASIN anahtarı. |
| R2 İPTAL → PSH'a gidiyor | ✅ | `Sat26!T2:T…`: 32 satır "İPTAL", **32'sinde `V` (İptal adet) boş**. `AN` (düzeltilmiş maliyet) iptali düşmüyor → **4.595,23 $** maliyet gerçekte yok. Depo26'da iptal filtresi yok. | İPTAL seçilince `V := O` otomatik; PSH çıktısında `Kargo durumu ≠ İPTAL` zorunlu (C1/C2). |
| R3 VLOOKUP aralıkları | ⚠️ | Aralıklar boş değil (`Sat26!A:AP` tam kolon, tam eşleşme, 6.701 formül). **Asıl sorun:** `ÖzRap!F37 =VLOOKUP(C1,'Excel&Amazon'!A:H,8,1)` ve `F38 =VLOOKUP(C1,I:J,2,1)` → son argüman `1` = **yaklaşık eşleşme**, sıralı olmayan veride yanlış satırı döner. `Excel&Amazon!I =vlookup(A,P:Q,…)` argümanı `#` ile eksik. | Hepsini `XLOOKUP(...;0)` / `VLOOKUP(...;FALSE)`; Python'da `merge(how="outer", validate="m:1")`. |
| R4 #VALUE! | ✅ | `ÖzRap!N5`, `N6` = `#VALUE!` ve **formül yok** (yapıştırılmış hata). `Excel&PSH`: **2.011 `#VALUE!` + 4.020 `#N/A`**. `Excel&Amazon`: 85 `#N/A`. `Excel&Ilab`: 139 `#DIV/0!`. `Kar`: 13 `#DIV/0!` (veri girilmemiş aylar) + 1 `#N/A`. `Sat26!AI`: **192 `#NAME?`** (Marka formülü, `LEFT` yerine tanınmayan fonksiyon). | `IFERROR` + boş ay için `IF(C=0;"";…)`; Marka'yı Python'da türet. |
| R5 Kuruş yuvarlama | ✅ | `Sat26!P =R/O`: **166/194** hücre 2 basamaktan uzun (ör. `P3=34,2633…`). `ΣR = 30.600,50` fakat `Σ ROUND(P,2)×O = 30.599,35` → **1,15 $ sapma**; 125 satırda >0,5 kuruş. | `ROUND(R/O;2)` ve kuruş farkını son birime dağıt (C1). |
| R6 Bundle/MultiPack | ⚠️ | `AE` MultiPack: 194/194 "NO". `AF` Bundle: 4 "YES", `AG` dolu: 4. `N` (Kaçlı paket) hiçbir satırda >1. Ürün adında pack/set/bundle geçen: 3. Yani işaretleme **tutarlı ama muhtemelen eksik** (hiç MultiPack yok). Depo26 `PalletId←Sat26!O` (adet!) eşlemesi de yanlış görünüyor. | Ürün adı regex'i ile uyarı; `N>1 ⇒ MultiPack=YES` kuralı. |
| R7 Order→Product 1:N | ✅ | 155 distinct order, **22'si çok ürünlü** (ör. `WO110094226` → satır 46,47). `R` (toplam maliyet) satır bazlı girilmiş; kargo/vergi orderda tek, satıra pay edilmemiş (**Varsayım:** bu yüzden Excel&PSH eşleşmesi order bazında sapıyor). | `orders` + `order_lines` tablosu; ek maliyeti satır değerine **oransal** dağıt. |
| R8 MSKU tutarsızlığı | ✅ | Kalıplar: `HRN-ASIN` 161, **başında `\n` olan 13** (`\nHRN-…` 10, `\nKHRN-…` 2, `\nFCR…` 1), `MH+ASIN` 9, `KHRN-` 5, `HRN1-` 4, çıplak ASIN 1 (`G138`), `L7-FTOK-K9TZ` 1 (`G133`). `F` (ASIN) kolonunda da `\n` var (`F170,171,181,184`). | Strip + `<br>` temizliği otomatik; kalıp dışı 5 satır elle (C1). |
| R9 Tarih formatı | ⚠️ | `Sat26!B` 194/194 Excel seri sayısı (sorun yok). Sorun `AM` "Tarih2": ay kodu ("M26","O26"…), **`T27` 1 satır (yazım hatası)**, 14 boş. `Orderno` içinde boşluk/satır sonu: 5 satır. | `Tarih2` türetilmiş kolon olsun (elle girilmesin). |
| R10 Exp date boş | ✅ | `Depo26!F` (ExpirationDate) 1. satırdan sonra **hiç formül/değer yok**; Sat26'da exp kolonu da yok. Takip no (`A`) de boş. | Sat26'ya `ExpDate` ekle; PSH çıktısında zorunlu (supplement ⇒ exp zorunlu). |
| R11 ILab farkı | ⚠️ | `Excel&Ilab!E =B/C` ve `H` → 139 `#DIV/0!`; iLab ile Excel arasında anahtar yok (ay bazlı toplam). `Kar!D` (COGS) iLab'den, `Sat26` maliyetinden değil. | Anahtar: MSKU+ay; fark = Sat26 `AN` − iLab COGS. |
| R12 Dosya sürümü | ✅ | `Den_Rapor` içinde kendi `Sat26`sı: **3.479 satır** (Yedek'te 195) → iki ayrı kaynak. Downloads'ta ek: `Cerberus_yedek.xlsx`, `Cerberus_yedek (1).xlsx`, `Sat_Cerberus.xlsx`. | Tek kaynak = SQLite; Excel yalnız çıktı. |

### Tarifte olmayan ek bulgular
- **R13** `Depo26!Q (Cost) ← Sat26!P` — PSH'a **düzeltilmemiş, yuvarlanmamış** birim maliyet gidiyor (`AN`'den değil).
- **R14** `Depo26!W (Action) ← Sat26!D (FBM/FBA)`; `Depo26!X (Notes) ← Sat26!M (drive linki)`: alan adı ile kaynak uyuşmuyor, gözle doğrula.
- **R15** `Kar!E` "Ofis Expenses" = Sales × %10 (ör. `E2=388,884 = 3888,84×0,10`) — **sabit varsayım**, gerçek gider değil. `Kar!F` (Net Profit) iLab'den gelip `E`'yi içermiyor gibi görünüyor (**doğrulanmadı**, formül zinciri çözülmeli).

**"Önce ölç" sonucu:** kod yazmadan önce yukarıdaki sayılar `validator` prototipiyle (scratchpad, depoya eklenmedi) gerçek veride yeniden üretildi: 32 İPTAL / 4.595,23 $ bloklama, 13 otomatik düzeltilebilir MSKU, 5 kalıp dışı MSKU, 125 satır kuruş sapması. Sayılar elle ölçümle birebir tuttu.

---

## B) As-Is → To-Be (13 adım; "10 adım" dedin ama listede 13 var)

> **Varsayım:** Süreler ölçülmedi. 200 sipariş × ~11 dk ≈ 37 saat/ay ile (senin 30–40 saat dediğin) tutarlı olacak şekilde dağıttım. **1 hafta sayaçla ölç, sonra güncelle.**

| # | Adım | Kim | As-Is dk/sipariş | Tipik hata | To-Be dk | Nasıl |
|---|---|---|---|---|---|---|
| 1 | Siteden ürün bul | Satın alan | 2,0 | Yanlış varyant/ASIN | 2,0 | Elle kalır (karar işi) |
| 2 | Kartla sipariş | Satın alan | 2,0 | Kart karışması (`AC`) | 2,0 | Elle kalır |
| 3 | Order PDF/no | Satın alan | 1,0 | No'da boşluk/satır sonu (R8/R9) | 0,3 | PDF'ten no çıkar |
| 4 | Sat26'ya giriş | Satın alan | 3,0 | R5, R8, R9, R7 | 0,7 | Tek form + anında doğrulama (C1) |
| 5 | Supplier maili | Satın alan | 0,7 | Unutulur | 0,1 | Şablon |
| 6 | Kargo durumu güncelle | Satın alan | 0,5 | İPTAL'de V boş (R2) | 0,1 | Durum → adet kuralı otomatik |
| 7 | Depo26 tarih filtresi | Operasyon | 0,4 | R1 `#REF!` | 0,05 | SQL view |
| 8 | PSH template'e yapıştır | Operasyon | 0,5 | R10, R13 | 0,05 | xlsx üretici (C2) |
| 9 | PSH batch aç | Operasyon | 0,2 | İsim tutarsız | 0,2 | Elle (PSH UI) |
| 10 | Depo eksik/fazla/hasar | Depo | 0,0* | — | 0,0 | *Sipariş başına değil, batch başına |
| 11 | Batch kapat → Amazon shipment | Operasyon | 0,1 | — | 0,1 | Elle |
| 12 | CSV indir → ILab yükle | Operasyon | 0,1 | R11 | 0,03 | Klasörden otomatik içe al |
| 13 | Den_Rapor karlılık/kayıp | Yönetici | 0,5 | R3, R4, R15 | 0,05 | Streamlit (C3) |
| | **Toplam** | | **≈ 11,0** | | **≈ 5,7** | **≈ %48 tasarruf ≈ 17–18 saat/ay** |

Gerçekçi beklenti: ~%50 (adım 1, 2 ve 9 elle kalıyor). %80+ iddia eden plana güvenme.

---

## C) Üç otomasyon

### Ortak mimari (Varsayım: yerel çalışır, tek kullanıcı)
```
cerberus_ops/
  requirements.txt
  app.py                 # streamlit run app.py
  cerberus/
    db.py                # SQLite bağlantı + şema
    validate.py          # C1
    psh.py               # C2
    profit.py            # C3
    ingest.py            # Excel/CSV → SQLite
  tests/
    test_validate.py  test_psh.py  test_profit.py
  data/cerberus.db       # tek doğruluk kaynağı (git'e girmez)
```
`requirements.txt`: `pandas>=2.2` `openpyxl>=3.1.5` `streamlit>=1.40` `pytest>=8`
**Uyarı (ölçtüm):** bu makinede pandas **3.x** kurulu; `str` dtype kolona `date` yazmak `TypeError` veriyor ve boş kolonlar DataFrame'e hiç gelmiyor. Aşağıdaki kod ikisini de ele alır. **openpyxl** `Cerberus_Den_Rapor2026.xlsx`'in stil bölümünü okuyamıyor (`PatternFill extLst` hatası) → `ingest.py` dosyayı önce Excel'de "Farklı kaydet" ile yeniden yazdır veya `python-calamine` kullan.

### C1 — Sat26 doğrulama botu (**gerçek veride çalıştırıldı**)
Kurallar: MSKU regex + `\n`/`<br>` temizliği · tarih normalizasyonu · İPTAL→`V:=O` + PSH blokajı · `ROUND(2)` · exp date zorunluluğu.
```python
# cerberus/validate.py
from __future__ import annotations
import re
from dataclasses import dataclass
from datetime import date, datetime, timedelta
import pandas as pd

MSKU_RE = re.compile(r"^(HRN|KHRN|FCR|MH)-?(B[0-9A-Z]{9})$|^[A-Z0-9]{2}-[A-Z0-9]{4}-[A-Z0-9]{4}$")
REQUIRED = ["MSKU", "ASIN", "Tarih", "Kargo durumu", "İptal adet-P1",
            "Ürün adedi", "Ürün toplam maliyeti", "ExpDate"]
IPTAL = {"İPTAL", "IPTAL", "CANCELLED"}

@dataclass
class Issue:
    row: int; code: str; field: str; msg: str; fixable: bool

def excel_date(v) -> date | None:
    if v in (None, ""): return None
    if str(v).replace(".", "", 1).isdigit():
        return (datetime(1899, 12, 30) + timedelta(days=float(v))).date()
    for fmt in ("%d.%m.%Y", "%m/%d/%Y", "%Y-%m-%d"):
        try: return datetime.strptime(str(v).strip(), fmt).date()
        except ValueError: pass
    return None

def validate_sat26(df: pd.DataFrame) -> tuple[pd.DataFrame, list[Issue]]:
    """df: Sat26 kolon adları, index = Excel satır no."""
    df, issues = df.astype(object).copy(), []          # pandas 3: str dtype date kabul etmez
    for c in REQUIRED:
        if c not in df: df[c] = None                   # tamamen boş kolon gelmeyebilir
    df = df.astype(object).where(df.notna(), None)     # NaN → None
    df["psh_blok"] = False
    for r, row in df.iterrows():
        raw = str(row["MSKU"] or "")
        clean = raw.strip().replace("<br>", "").upper()
        if clean != raw:
            issues.append(Issue(r, "R8", "MSKU", f"temizlendi: {raw!r}", True)); df.at[r, "MSKU"] = clean
        if not MSKU_RE.match(clean):
            issues.append(Issue(r, "R8", "MSKU", f"kalıp dışı: {clean!r}", False))
        d = excel_date(row["Tarih"])
        if d is None: issues.append(Issue(r, "R9", "Tarih", f"geçersiz: {row['Tarih']!r}", False))
        else: df.at[r, "Tarih"] = d
        if str(row["Kargo durumu"] or "").strip().upper() in IPTAL:
            df.at[r, "psh_blok"] = True
            if not row["İptal adet-P1"]:
                issues.append(Issue(r, "R2", "İptal adet-P1", "İPTAL ama adet boş", True))
                df.at[r, "İptal adet-P1"] = row["Ürün adedi"]
        elif not row["ExpDate"]:
            issues.append(Issue(r, "R10", "ExpDate", "PSH için zorunlu", False))
        unit = round(float(row["Ürün toplam maliyeti"]) / float(row["Ürün adedi"]), 2)   # ROUND(2)
        df.at[r, "Ürün birim maliyeti"] = unit
        if abs(unit * float(row["Ürün adedi"]) - float(row["Ürün toplam maliyeti"])) > 0.005:
            issues.append(Issue(r, "R5", "Ürün birim maliyeti", "yuvarlama farkı", False))
    return df, issues
```
**Gerçek veri sonucu (ExpDate kuralı eklenmeden önceki sürüm):** 194 satır → 175 sorun: R2 32 (otomatik), R8 13 otomatik + 5 elle, R5 125. `psh_blok=32`, bloklanan maliyet **4.595,23 $**. ExpDate kuralını sonradan eklediğim için o satırı çalıştırmadım; Sat26'da exp kolonu olmadığından hepsi R10 verir.
**Bilinen sınır:** `L7-FTOK-K9TZ` (`G133`) üçüncü kalıba uyduğu için geçer, ASIN uyuşmazlığı ayrıca yakalanmaz.

### C2 — PSH batch üretici (**test edilmedi**, yalnız tasarım)
Depo26'nın 24 kolonu (`TrackingNumber…Notes`) ölçüldü; SQL view bu kolon adlarını üretir, böylece LoadData aynen kalır.
```python
# cerberus/psh.py
import sqlite3, pandas as pd

PSH_COLS = ["TrackingNumber","OrderNumber","OrderNumberSold","PalletId","ShipmentDate","ExpirationDate",
            "ASIN","MSKU","UPC","FNSKU","SerialNo","ProductTitle","ManufactureOrSupplier","ProductGroup",
            "NumberOfUnits","Condition","Cost","SalePrice","Fragile","MultiPack","Bundle","CountPerBundle",
            "Action","Notes"]

VIEW = """
CREATE VIEW IF NOT EXISTS v_psh AS
SELECT tracking AS TrackingNumber, order_no AS OrderNumber, order_no AS OrderNumberSold,
       NULL AS PalletId, order_date AS ShipmentDate, exp_date AS ExpirationDate,
       asin AS ASIN, msku AS MSKU, NULL AS UPC, NULL AS FNSKU, NULL AS SerialNo,
       title AS ProductTitle, supplier_code AS ManufactureOrSupplier, NULL AS ProductGroup,
       (qty - cancelled - missing - damaged - expired) AS NumberOfUnits,
       condition AS Condition, ROUND(corrected_cost / NULLIF(qty - cancelled - missing - damaged - expired,0), 2) AS Cost,
       sale_price AS SalePrice, fragile AS Fragile, multipack AS MultiPack, bundle AS Bundle,
       count_per_bundle AS CountPerBundle, channel AS Action, drive_link AS Notes
FROM sat26
WHERE ship_status <> 'İPTAL' AND exp_date IS NOT NULL AND qty - cancelled > 0
"""

def build_batch(con: sqlite3.Connection, start: str, end: str, out_xlsx: str) -> pd.DataFrame:
    df = pd.read_sql("SELECT * FROM v_psh WHERE ShipmentDate BETWEEN ? AND ?", con, params=(start, end))
    assert list(df.columns) == PSH_COLS, "PSH kolon sırası bozuldu"
    df.to_excel(out_xlsx, index=False, sheet_name="LoadData")
    return df
```
Not: `PalletId` eski Depo26'da adete bağlıydı (R6/R14) — **boş bıraktım**; PSH'ın bu alanı gerçekten ne beklediğini doğrula (**Varsayım**).
Test: ① iptal satır çıktıda yok ② exp boş satır çıktıda yok ③ `Cost × NumberOfUnits = corrected_cost ± 0,01` ④ kolon sırası değişmedi.

### C3 — Kar sayfası otomatik (**test edilmedi**)
`iLabKar` yapısı ölçüldü: satırlar kalem (`Sales`, `Cost Of Goods Sold`, `Net Profit`…), kolonlar aylar. `AmazonKar`: `Product sales / Expenses / Net income` × ay.
```python
# cerberus/profit.py
import pandas as pd
MONTHS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"]

def ilab_long(wide: pd.DataFrame) -> pd.DataFrame:
    """iLabKar (kalem × ay) → uzun tablo (item, month, amount)."""
    wide = wide.rename(columns={wide.columns[0]: "item"}).dropna(subset=["item"])
    long = wide.melt(id_vars="item", value_vars=[m for m in MONTHS if m in wide], var_name="month", value_name="amount")
    long["amount"] = pd.to_numeric(long["amount"], errors="coerce").fillna(0).round(2)
    return long

def kar_table(ilab: pd.DataFrame, amazon: pd.DataFrame, office_pct: float = 0.10) -> pd.DataFrame:
    p = ilab.pivot_table(index="month", columns="item", values="amount", aggfunc="sum").reindex(MONTHS)
    out = pd.DataFrame({"Sales": p.get("Sales"), "COGS": p.get("Cost Of Goods Sold"), "NetProfit": p.get("Net Profit")})
    out["Ofis"] = (out["Sales"] * office_pct).round(2)           # R15: varsayım, parametre
    out["Karlilik%"] = ((out["NetProfit"] / out["Sales"]) * 100).where(out["Sales"] > 0).round(2)  # IFERROR karşılığı
    out["KumNet"] = out["NetProfit"].fillna(0).cumsum().round(2)
    amz = amazon.set_index("month")["Product sales"].reindex(MONTHS)
    out["Fark_AmazonVsILab"] = (amz - out["Sales"]).round(2)
    return out
```
Test: Ocak için `Sales=3888,84`, `NetProfit=-300,48`, `Karlilik%=-7,73`; veri olmayan ay `NaN` (eski `#DIV/0!` yerine).

---

## D) Test senaryoları (özet)
| Modül | Senaryo | Beklenen |
|---|---|---|
| C1 | `\nHRN-B0D19FGYZG` | `HRN-B0D19FGYZG`, issue R8 fixable |
| C1 | `HRN1-B010M8ZBTY` | R8 fixable=False |
| C1 | İPTAL, V boş, O=4 | `V=4`, `psh_blok=True` |
| C1 | `R=185,44, O=4` | birim 46,36; fark ≤ 0,005 |
| C1 | **Altın dosya testi:** Yedek_21Ags → 32 R2, 18 R8, toplam bloklama 4.595,23 | birebir |
| C2 | İPTAL + exp'li satır | çıktıda yok |
| C3 | Ağustos+ (veri yok) | `NaN`, hata yok |

---

## E) Haftalık uygulama planı
Önkoşul (Pzt sabah): **karar kapısı** — aşağıdaki "Açık sorular" cevaplanmadan kod yazılmaz.

| Gün | Yapılacak | Çıktı / Ölçüt |
|---|---|---|
| Pzt | Sayaçla 1 günlük süre ölçümü; tek kaynak dosyayı seç (R12); Den_Rapor'u Excel'de yeniden kaydet; `ingest.py` + SQLite şema | Sat26 → `sat26` tablosu, satır sayısı Excel ile aynı |
| Sal | C1 doğrulama + pytest, altın dosya testi | 32 / 18 / 4.595,23 yeniden üretilir |
| Çar | Streamlit giriş formu (tek satır + order bazlı çok kalem) | Elle girişte hatalı MSKU kabul edilmez |
| Per | C2 PSH üretici; eski Depo26 çıktısıyla **satır satır fark** | Fark yalnız iptal/exp/yuvarlama kaynaklı |
| Cum | C3 Kar + demo; 1 gerçek ayı eski Kar sayfasıyla karşılaştır | Demo: aynı ay, iki sayfa, farklar açıklanmış |

Aşırı iddia etmemek için: Cuma'da **paralel çalıştır** (eski + yeni); eskisini kapatma.

## F) Günlük Claude prompt şablonu (10 madde)
1. "Bugünün tarihi X. Dün `git log` / değişen dosyalar nedir? Kaldığımız yeri 3 madde özetle."
2. "Bugünkü hedef: <tek cümle>. Başarı ölçütü: <sayı>. Önce mevcut veriyle ölç, sonra kodla."
3. "Bu yeni Sat26 dışa aktarımını `validate_sat26`'dan geçir; R-kodlarına göre sorun sayısını ver."
4. "Yeni bir hata türü gördüm: <örnek satır>. Hangi R koduna girer, yeni kural gerekir mi?"
5. "Bu değişiklik için önce başarısız test yaz, sonra düzelt, sonra tüm testleri çalıştır."
6. "PSH çıktısını eski Depo26 ile karşılaştır; farkı neden→adet tablosu olarak ver."
7. "Bu ayın Kar tablosunu üret; iLab ve Amazon farkı >%2 ise nedenini listele."
8. "Varsayımlarını ve **ölçmediğin** şeyleri ayrı ayrı yaz."
9. "Bugün hiçbir veriyi silme/üzerine yazma; her yazma işleminden önce yedek al ve ne yazacağını göster."
10. "Gün sonu: yaptıklarım, bozulanlar, yarın ilk iş. `docs/` altındaki günlüğe ekle."

---

## Kararlar (2026-10-22)
1. **Yığın: mevcut allinone-saas (Next.js 16 + Postgres/Drizzle + vitest).** Ayrı Python/Streamlit projesi YOK. Bu rapordaki Python kodları (C1–C3) yalnız **mantık referansı**; uygulama TypeScript domain modülleri olarak yazılır (`src/domain/`). `orders` tablosu zaten Sat26'nın Postgres karşılığı, `prepshipReconciliation` / `importValidation` / `excelDate` yeniden kullanılır.
2. **Sıra:** önce R1–R12 temizliği → PSH batch üretici → Kar/dashboard → dört karşılaştırma.
3. **Ofis Expenses = satışın %10'u** (sabit, ayarlanabilir sabit olarak kodlanacak).
4. **Bekleyen:** banka ekstresi ve kart harcama dosyası örneği (4. karşılaştırma için). `Receipt` sayfası banka değil, Amazon inventory receipt'i.

## Uygulama durumu
| Dilim | Durum |
|---|---|
| 1 · Sat26 hijyeni (R2, R5, R8) — `src/domain/sat26Hygiene.ts` + `import-xls` bağlantısı, 31 test | ✅ yapıldı |
| 2 · PSH batch üretici: mevcut `prepship-export` zaten 24 kolonlu LoadData üretiyordu; İPTAL satırlar dışlanır, kısmi iptalde adet düşer, Cost/SalePrice ROUND(2). Mevcut kayıtlar için salt okunur denetim `GET /api/operations/sat26-audit`. 10 yeni test | ✅ yapıldı. Düzeltme adımı da eklendi: `POST /api/operations/sat26-audit` (varsayılan önizleme, `apply:true` tek transaction + audit_logs; kalıp dışı MSKU'ya dokunmaz) ve Karşılaştırma sekmesinde "Denetle → Düzeltmeyi uygula" paneli |
| 3 · Kar & dashboard: `store_financials` tablosu (migration 0015), `src/domain/storeProfit.ts` (Ofis %10), `GET/POST /api/analytics/store-profit`, "Mağaza Karlılığı" sekmesi. 10 test | ✅ yapıldı — canlı veritabanında denenmedi; aylık rapor içe aktarma (dosya yükleme) henüz yok, kalemler formdan girilir |
| R10 · Exp date | ⏸ ertelendi (kullanıcı kararı 2026-10-22: şimdilik kullanılmıyor) |
| 4a · Karşılaştırma 2 (Amazon kabul) ve 3 (Inventory Lab): `src/domain/salesReconciliation.ts`, `POST /api/reconciliation/compare`, "Karşılaştırma" sekmesi (dosya yükle → ASIN bazında fark, CSV). 13 test; **gerçek veride doğrulandı**: Amazon −1/−3/−1 ve iLab −5,50/−3,50 farkları Den_Rapor ÖzRap ile birebir | ✅ yapıldı |
| 4b · Karşılaştırma 1 (Sat26 ↔ PSH ↔ iLab, üçlü; ASIN + order sayısı + fiyat) | ⏳ sırada |
| 4c · Karşılaştırma 4 (banka makbuzu ↔ kart harcamaları) | ⏳ banka/kart dosyası örneği bekleniyor |
