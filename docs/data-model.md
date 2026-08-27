# CERBERUS — CANONICAL DATA MODEL (FAZ 1)

## TEMEL AYRIM: PRODUCT ≠ VARIANT ≠ LISTING

```text
PRODUCT MASTER (product_masters)
   ├── ASIN, UPC, GTIN, Marka, Kategori
   ├── Decision Engine (BUY | TEST | WAIT | REJECT)
   ├── Confidence Score (%) + Data Quality (VALID | STALE | CONFLICTING) + Freshness (FRESH | EXPIRED)
   ├── AI Evidence Chain JSONB
   └── Multi-Store Channel Listings JSONB
          ├── Amazon Store 01 (AMZ-US-01): $189.00 • Active Stock: 65
          ├── Walmart Store 01 (WMT-US-01): $188.00 • Active Stock: 35
          └── Shopify DTC Store 05 (SHP-US-05): $194.00 • Active Stock: 24
```
