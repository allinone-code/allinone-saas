# CERBERUS — DATA DICTIONARY

| Alan Adı | Tip | Geçerli Değerler / Açıklama |
|---|---|---|
| `decisionAction` | Enum/Text | `BUY`, `TEST`, `WAIT`, `REJECT`, `REPRICE`, `REORDER`, `PAUSE`, `LIQUIDATE` |
| `dataQualityStatus` | Enum/Text | `VALID`, `INVALID`, `MISSING`, `STALE`, `CONFLICTING`, `UNVERIFIED` |
| `dataFreshnessStatus`| Enum/Text | `FRESH` (0-3 gün), `AGING` (4-7 gün), `STALE` (8-14 gün), `EXPIRED` (>14 gün) |
| `cargoStatus` | Text | `Tam Geldi`, `İPTAL`, `Yolda`, `Kayıp Depoya gelmiş` |
| `pshStatus` | Text | `BEKLIYOR`, `BATCH_OLUSTURULDU`, `DEPO_SAYILDI`, `AMAZONA_SEVK` |
