# Product Library Enhancement Design

**Date:** 2026-07-16

**Goal:** Upgrade the current lightweight product master into a formal product library that supports independent sales and purchase codes, quote-stage candidate products, conversion into formal products, supplier-code association, and quantity-based sales price tiers without breaking the existing `productId` business chain.

**Scope:** Extend the current product master data, quote create flow, and downstream product selection rules. The design must preserve the existing `productId` linkage already used by quotes, sales orders, purchase orders, stock, and reports.

---

## 1. Context

The current ERP already has a usable product master, but it behaves more like an MVP SKU list:

- one internal code (`sku`)
- Chinese and English names
- category
- unit
- default sale price
- default purchase price
- owner
- active / inactive status

That structure is enough for demo, but it does not support the product operations now requested:

- sales code and purchase code must be independent
- purchase code may be system-generated or manually entered
- quoted products may exist before they are complete formal master data
- sales price may vary by quantity such as 100 pcs vs 1000 pcs
- supplier linkage should use the supplier code from counterparty master data
- product library should cover both quoted products and later order products

The existing architecture already uses `productId` broadly. Replacing product linkage or introducing a second permanent product entity would create avoidable downstream complexity. The enhancement should therefore extend the current product master instead of replacing it.

---

## 2. Scope And Non-Goals

### In Scope

- extend product master fields for formal operations
- rename the business meaning of current `sku` to internal product code
- add separate sales code and purchase code
- allow purchase code to be generated or manually entered
- add product stage to distinguish quote candidates from formal products
- support quote-time candidate product creation
- support one-click conversion from candidate to formal product
- add default supplier code linked to counterparty `code`
- support fixed sale price and tiered sale price
- keep default purchase price and default sale price for compatibility
- update product page filters, forms, and list columns
- update quote create flow so it can choose formal products or create candidate products
- define validation rules for candidate and formal products

### Out Of Scope

- product image upload and gallery management in this phase
- multi-supplier price comparison inside product master
- historical purchase price timeline
- automatic price approval workflow
- barcode / QR code workflows
- BOM, kit, or variant matrix modeling
- automatic migration of all legacy quote payloads to richer product metadata

---

## 3. Recommended Approach

### Option A: Expand `Product` Only And Store Price Tiers In JSON

Keep a single product table and add all requested fields directly. Store quantity price tiers in a JSON field on the product record.

This is fast but weak:

- tier validation is harder
- future querying by quantity band is awkward
- UI editing logic becomes harder to keep stable
- future reuse in sales flows is less clean

### Option B: Expand `Product` And Add A Dedicated Price Tier Entity (Recommended)

Keep the current `Product` entity as the single product identity and extend it with:

- internal product code
- sales code
- purchase code
- product stage
- pricing mode
- supplier code linkage
- packaging and weight fields

Then add a dedicated `ProductSalePriceTier` child entity for quantity-based sale prices.

This keeps one product identity for the entire ERP and adds the richer pricing behavior without fragmenting the model.

### Option C: Add A Separate Quote Candidate Product Table

Create a parallel quote-only product pool, then convert into `Product` later.

This isolates quote-stage data but introduces a second long-lived product identity and complicates every downstream conversion path.

### Recommendation

Choose Option B.

The ERP should keep a single `productId` identity across quote, sales, purchase, warehouse, and reporting. Quote-stage uncertainty should be modeled as a product stage, not as a separate long-term product system.

---

## 4. Product Domain Model

### 4.1 Product Identity

The product library should use three different codes with clear purposes:

| Field | Purpose | Visibility |
|---|---|---|
| `internalCode` | Current system-wide internal product identifier. This is the current `sku` field under a clearer business meaning. | Internal |
| `salesCode` | Customer-facing / sales-side code. Must be manually entered. | Sales-visible |
| `purchaseCode` | Procurement-side code. May be manually entered or generated. | Purchase-visible |

`internalCode` remains the durable internal identity for business document linking and compatibility.

### 4.2 Product Stage

Product stage should be explicit:

- `quote_candidate`
- `formal`

Meaning:

- `quote_candidate`: product is allowed to exist with incomplete formal attributes so quotes can proceed
- `formal`: product is approved for standard downstream use in product master, quoting, procurement, and warehouse flows

### 4.3 Pricing Mode

Pricing mode should distinguish simple and quantity-based behavior:

- `fixed`
- `tiered`

Rules:

- `fixed`: use default sale price
- `tiered`: use quantity-based price tiers, with default sale price as fallback

---

## 5. Product Fields

### 5.1 Core Product Fields

| Field | Meaning | Required For Candidate | Required For Formal |
|---|---|---|---|
| `category` | Product classification | yes | yes |
| `productName` | Main product name | yes | yes |
| `nameEn` | English name | no | no |
| `internalCode` | Internal product code, unique | yes | yes |
| `salesCode` | Sales code, manual entry | no | yes |
| `purchaseCode` | Purchase code, manual or generated | no | no |
| `purchaseCodeMode` | `manual` / `generated` | no | no |
| `brand` | Brand | no | no |
| `factoryName` | Factory | no | no |
| `model` | Model | no | no |
| `spec` | Single-item specification | no | no |
| `ownerName` | Product owner | yes | yes |
| `productStage` | Candidate or formal | yes | yes |
| `status` | Active or inactive | yes | yes |

### 5.2 Packaging And Logistics Fields

| Field | Meaning |
|---|---|
| `unit` | Base selling / stocking unit |
| `singleWeight` | Weight per single unit |
| `cartonSpec` | Carton specification |
| `cartonQuantity` | Quantity per carton |
| `cartonWeight` | Weight per carton |

These remain optional in this phase, but the structure should be ready now so the formal product library stops being only a price list.

### 5.3 Pricing And Supplier Fields

| Field | Meaning |
|---|---|
| `defaultPurchasePrice` | Default procurement reference price |
| `defaultSalePrice` | Default selling reference price or tier fallback |
| `pricingMode` | `fixed` / `tiered` |
| `defaultSupplierCode` | Supplier code from counterparty master |
| `currency` | Price currency |

### 5.4 Supplier Linkage Rule

`defaultSupplierCode` must reference a counterparty whose type is `supplier` or `both`.

Validation behavior:

- blank is allowed
- if provided, code must exist in counterparty master
- inactive suppliers may be blocked from new selections but still displayed on legacy records

---

## 6. Sales Price Tier Model

### 6.1 Dedicated Tier Entity

Add a child entity `ProductSalePriceTier`.

Suggested fields:

| Field | Meaning |
|---|---|
| `id` | Unique row ID |
| `productId` | Parent product |
| `minQuantity` | Minimum quantity threshold |
| `salePrice` | Price used when threshold is met |
| `currency` | Tier currency |
| `status` | active / inactive |
| `createdBy` / `updatedBy` / timestamps | Audit metadata |

### 6.2 Tier Rules

- one product may have many active tiers
- `minQuantity` must be positive
- `minQuantity` must be unique within the same product
- tiers are ordered ascending by `minQuantity`
- when quantity matches multiple tiers, use the highest satisfied threshold

Example:

| `minQuantity` | `salePrice` |
|---|---|
| 1 | 120 |
| 100 | 108 |
| 1000 | 96 |

Then:

- quantity 80 -> 120
- quantity 100 -> 108
- quantity 500 -> 108
- quantity 1000 -> 96

### 6.3 Fallback Rule

If `pricingMode = tiered` and no active tier matches, fall back to `defaultSalePrice`.

This preserves safety for quote creation and avoids blocking all sales flows when tiers are incomplete.

---

## 7. Quote Candidate Product Flow

### 7.1 Quote Create Modes

The quote create page should support both:

- choose an existing product
- create a new quote candidate product inline or through a quick-create panel

### 7.2 Candidate Creation Rules

When a quote user creates a new quote candidate product:

- create a new `Product`
- set `productStage = quote_candidate`
- set `status = active`
- allow incomplete formal fields
- attach the new `productId` directly to quote items

This means quoted products already live in the product library and do not require a second identity later.

### 7.3 Convert To Formal Product

The product library page should support a `Convert To Formal` action for candidate products.

Conversion rules:

- validate formal-required fields
- if `purchaseCodeMode = generated` and no purchase code exists, generate one at conversion time
- keep the same `productId`
- switch `productStage` from `quote_candidate` to `formal`
- write audit logs for the conversion action

### 7.4 Formal Validation Gate

Required for formal products:

- category
- product name
- internal product code
- sales code
- owner name
- product stage
- pricing mode

Additional rule:

- if `pricingMode = tiered`, at least one active price tier must exist

---

## 8. Purchase Code Strategy

`purchaseCode` should support two modes:

- `manual`
- `generated`

Recommended generation behavior:

- generate only when user requests it or when formal conversion requires it
- generated code should be deterministic in format but not tied to `productId` semantics visible to users
- suggested format: `PUR-<category-prefix>-<sequence>`

The system must still allow later manual override if the business wants a supplier-aligned code.

---

## 9. UI And Page Design

### 9.1 Product Library Page

The current product master page should evolve into a more structured formal product library with:

- top summary / explanation strip
- filter bar
- paginated list
- create form
- row-level edit panel
- dedicated sale price tier area per product

### 9.2 Filter Set

Recommended filters:

- product stage
- category
- status
- owner
- pricing mode
- keyword

### 9.3 List Columns

Recommended primary columns:

- product name
- internal product code
- sales code
- purchase code
- category
- default supplier code
- default purchase price
- pricing mode
- default sale price or tier count
- product stage
- status

### 9.4 Edit Layout

To avoid an ugly overloaded table, product editing should be sectioned:

- Basic Info
- Packaging Info
- Pricing And Supplier
- Sale Price Tiers

The current inline edit panel pattern can remain, but fields should be visually grouped instead of placed as one long undifferentiated grid.

### 9.5 Quote Create Page

Quote creation should expose:

- existing formal products
- optionally candidate products
- a quick entry path for creating a new quote candidate product

The quote page does not need the full formal product form. It only needs the minimal fields required to produce a candidate product that can be referenced immediately.

---

## 10. Compatibility Strategy

The enhancement must keep the current system stable.

### 10.1 Keep `productId`

Do not replace or remap downstream product linkage. The following flows should continue using the same `productId`:

- quote
- sales order
- purchase order
- stock-in
- stock-out
- inventory
- reports

### 10.2 Keep Existing Price Fields

Retain:

- `defaultSalePrice`
- `defaultPurchasePrice`

These remain compatibility fields even after tiered pricing is introduced.

### 10.3 Keep Existing `sku` Storage

The current `sku` database field can remain physically unchanged in this phase, but its business label in UI and documentation should become `internal product code`.

This reduces migration and downstream breakage while giving the business clearer terminology.

---

## 11. API Shape

### 11.1 Product List And Detail

Product API responses should expand to include:

- `internalCode`
- `salesCode`
- `purchaseCode`
- `purchaseCodeMode`
- `productStage`
- `pricingMode`
- `brand`
- `factoryName`
- `model`
- `spec`
- `singleWeight`
- `cartonSpec`
- `cartonQuantity`
- `cartonWeight`
- `defaultSupplierCode`
- `salePriceTiers`

### 11.2 Candidate Product Creation

Support one of these API strategies:

- extend `POST /api/products` with stage-aware validation
- or add `POST /api/products/candidates`

Preferred approach:

- keep `POST /api/products`
- drive behavior through payload fields such as `productStage`

This minimizes controller surface growth.

### 11.3 Conversion Action

Add a dedicated action such as:

- `POST /api/products/{id}/convert-to-formal`

This keeps conversion explicit, auditable, and validation-safe.

---

## 12. Validation Rules

### Candidate Product

Minimum required:

- category
- product name
- internal product code
- owner name

### Formal Product

Required:

- category
- product name
- internal product code
- sales code
- owner name
- pricing mode

Conditional:

- tiered mode requires at least one active sale price tier
- provided supplier code must match an active or existing supplier counterparty

### Code Uniqueness

- `internalCode` must be unique
- `salesCode` should be unique when present
- `purchaseCode` should be unique when present

---

## 13. Audit And Reporting Considerations

Audit logs should record:

- product creation
- candidate creation
- conversion to formal
- product field update
- price tier create / update / deactivate
- activation / deactivation

Reports and downstream pages do not need immediate redesign in this phase, but they should be able to display:

- sales code where customer-facing context exists
- purchase code where procurement-facing context exists

---

## 14. Testing Strategy

### Backend

- Prisma schema tests for new product and price tier fields
- product service tests for candidate validation, formal conversion, code uniqueness, supplier linkage, generated purchase code, and tier resolution
- quote service tests for candidate product creation and quote linkage
- controller tests for conversion action and stage-aware create payloads

### Frontend

- product page tests for new fields, filters, and conversion action
- quote create tests for selecting existing products and creating candidate products
- form tests for stage-aware required fields
- pagination and row edit tests must remain green

### Regression

The existing product, quote, sales, purchase, inventory, and formal-page suites must remain green after the enhancement.

---

## 15. Implementation Sequence

Recommended order:

1. schema and persistence shape
2. backend product service and validation
3. quote create flow candidate support
4. product master UI field expansion
5. price tier UI
6. downstream display refinement

This sequence protects the current chain while enabling gradual UI exposure.
