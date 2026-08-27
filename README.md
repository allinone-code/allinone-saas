# CERBERUS — Product Intelligence & Commerce Operations Platform

**Cerberus** is an enterprise-grade multi-store SaaS built for high-velocity US product sourcing, landed-cost profitability intelligence, duplicate detection, and 26-store marketplace operations.

---

## 🏛️ Architecture & Core Domains

1. **Executive Dashboard & 4-Layer Operations Center**
   - **Executive Dashboard**: Unified cross-channel view of 26 storefronts with live Gross Revenue ($2.84M+), Net Profit ($682K+), Active Listings (3,140+), and Average Portfolio ROI (48.2%).
   - **Product Sourcing & Discovery Intelligence**: 13-stage lifecycle tracking with live search, filters, and 360° inspector.
   - **10-Person US Sourcing Team Leaderboard**: Measures true commercial conversion (*Discovery Volume → Approval Rate → Purchase Conversion → Net ROI → Problem Rate*).
   - **26 Multi-Store Fleet**: 18 Amazon storefronts, 2 Walmart accounts, 5 Shopify DTC stores, and 1 B2B Wholesale Portal.
   - **P1–P4 Operational Alarm Center**: Instant alerts for BuyBox price shifts, Amazon account health warnings, and supplier stockouts.

2. **13-Stage Central Product Lifecycle**
   $$\text{DISCOVERED} \rightarrow \text{SCREENING} \rightarrow \text{DUPLICATE\_CHECK} \rightarrow \text{ANALYZING} \rightarrow \text{REVIEW} \rightarrow \text{APPROVED} \rightarrow \text{PURCHASING} \rightarrow \text{RECEIVED} \rightarrow \text{LISTING} \rightarrow \text{ACTIVE} \rightarrow \text{MONITORING} \rightarrow \text{PAUSED} \rightarrow \text{DISCONTINUED}$$

3. **Landed Cost & Profitability Engine**
   - Calculates landed cost with true precision:
     $$\text{Landed Cost} = \text{Source Price} + \text{Supplier Shipping} + \text{Prep/Label} + \text{Amazon Fee (15\%)} + \text{FBA Fulfillment Fee}$$
     $$\text{ROI (\%)} = \frac{\text{Estimated Net Profit}}{\text{Total Landed Cost}} \times 100$$
   - SVG Cost History timeline tracking cost evolution over time.

4. **AI Opportunity Score Radar (0–100)**
   - 6-axis hexagonal SVG visualization evaluating:
     - `PROFITABILITY`
     - `DEMAND`
     - `COMPETITION`
     - `PRICE STABILITY`
     - `SUPPLIER RELIABILITY`
     - `OPERATIONAL RISK`
   - AI Decision Support recommendations: `HIGH_MARGIN_SCALER`, `APPROVED_FOR_PURCHASE`, `HOLD_FOR_PRICE_DROP`, `FLAGGED_IP_RISK`.

5. **Chrome Extension Quick-Capture & Excel Migration Pipeline**
   - 1-click US retail deal capture (*Home Depot, Ulta, Costco, BestBuy, Target, Grainger*) with live UPC/ASIN duplicate checking.
   - Batch Excel/CSV import pipeline with normalization and duplicate detection.

6. **Immutable Audit Security Log**
   - Tracks `WHO • WHAT • WHEN • BEFORE • AFTER` for every pricing change, status update, and discovery submission.

---

## 🚀 Live Deployment to Vercel & Neon

1. Push this repository to GitHub (`allinone-code/allinone-saas`).
2. Create a serverless PostgreSQL database on [Neon](https://neon.tech) (Frankfurt region recommended).
3. Push schema to Neon:
   ```bash
   DATABASE_URL="your-neon-pooled-connection-string" npx drizzle-kit push
   ```
4. Deploy to [Vercel](https://vercel.com) and set the `DATABASE_URL` environment variable.
5. On initial load, the system automatically seeds demo data (26 stores, 10 specialists, suppliers, products, problems, and audit logs).
