# Inventory And Warehouse Design

**Date:** 2026-07-14

**Goal:** Add a formal warehouse layer to the existing ERP so procurement receiving and sales fulfillment can move through explicit inbound and outbound stock documents, with traceable inventory balances and ledger history.

**Scope:** Standard warehouse layer for phase one, including warehouse master data, location master data, stock-in orders, stock-out orders, inventory balances, inventory ledger, and minimal manual adjustment. The design must extend the current sales order -> purchase order -> shipment batch chain without replacing existing pages or business document patterns.

---

## 1. Context

The current formal ERP already covers:

- sales orders
- purchase orders
- shipment batches
- after-sales
- finance confirmation
- boss dashboard
- audit center

Those modules are enough for MVP demo and acceptance, but they do not yet have a real warehouse layer. Today the flow can show procurement and shipment progress, but it cannot answer core warehouse questions reliably:

- what quantity is currently in stock
- which warehouse holds the stock
- which movement created the stock
- whether a shipment is physically ready to leave

The next formal phase should not jump directly into a heavy WMS. It should first add a stable warehouse execution layer that supports stock entry, stock exit, balance queries, and document traceability.

---

## 2. Scope And Non-Goals

### In Scope

- add warehouse master data
- add warehouse location master data
- add stock-in orders for procurement receiving and manual entry
- add stock-out orders for sales fulfillment and manual exit
- add inventory balance query by product, warehouse, and location
- add inventory ledger for every confirmed movement
- add minimal manual positive and negative adjustment with reason
- connect stock-out confirmation with the existing shipment batch flow
- connect stock-in confirmation with the existing purchase flow
- add role-aware UI and action visibility for warehouse operations

### Out Of Scope

- batch / lot management
- frozen inventory / reservation engine
- warehouse transfer between locations or warehouses
- cycle count / stocktake workflows
- barcode / scanner workflows
- wave picking or complex outbound orchestration
- quality inspection workflows
- automatic costing, valuation, or accounting voucher generation

---

## 3. Recommended Approach

### Option A: Status-Only Extension

Keep using purchase orders and shipment batches directly. Add a few extra fields such as stock-in status and stock-out status, but do not create separate warehouse documents.

This is fast but weak. Inventory balance, audit traceability, and later warehouse expansion would become difficult very quickly.

### Option B: Standard Warehouse Layer (Recommended)

Add separate warehouse documents and balance projections while preserving the current ERP document chain:

- purchase order drives stock-in order creation
- stock-in confirmation increases inventory
- sales fulfillment drives stock-out order creation
- stock-out confirmation decreases inventory
- shipment batch remains the external fulfillment and receipt document

This keeps boundaries clear and lets later phases add batch, transfer, or stocktake on top of the same warehouse foundation.

### Option C: Expanded Warehouse Layer

Add standard warehouse plus batch, freeze, adjustment categories, stocktake, and transfer in one phase.

This is too large for the next slice and would slow down formal ERP delivery.

### Recommendation

Choose Option B. It provides a real warehouse layer without turning this phase into a full WMS rebuild.

---

## 4. Business Boundaries

The warehouse layer should sit between procurement and physical shipment.

### Inbound Boundary

- procurement approval does not increase inventory
- goods arrival creates or updates a stock-in order
- only confirmed stock-in increases inventory

### Outbound Boundary

- sales approval does not decrease inventory
- shipment planning creates or updates a stock-out order
- only confirmed stock-out decreases inventory
- shipment batch remains the external shipping document after warehouse exit

### Traceability Boundary

Every confirmed inventory change must be traceable to one source:

- purchase order
- sales order
- shipment batch
- manual adjustment

---

## 5. Module Map

| Module | Responsibility |
|---|---|
| Warehouse Master | Manage warehouses and active status |
| Location Master | Manage locations within warehouses |
| Stock-In Center | Manage receiving and manual inbound documents |
| Stock-Out Center | Manage outbound execution and manual outbound documents |
| Inventory Center | Show balances and ledger history |
| Inventory Posting Service | Apply the single source of truth for inventory increments and decrements |

The new modules should follow the same formal page pattern already used by sales, purchase, finance, and reports.

---

## 6. Data Model

### 6.1 Core Entities

| Entity | Purpose |
|---|---|
| `warehouse` | Warehouse header such as main warehouse or returns warehouse |
| `warehouse_location` | Physical location under a warehouse |
| `stock_in_order` | Inbound document header |
| `stock_in_item` | Inbound document line items |
| `stock_out_order` | Outbound document header |
| `stock_out_item` | Outbound document line items |
| `inventory_ledger` | Immutable movement ledger |
| `inventory_balance` | Current projected balance by product + warehouse + location |

### 6.2 Document Source Links

Warehouse documents should store references to the upstream business document:

- `sourceBizType`
- `sourceBizId`
- `sourceDocNo`

This should be available on both stock-in and stock-out headers so the audit center and details pages can cross-link cleanly.

### 6.3 Balance Design

`inventory_balance` should be a dedicated projection table instead of a JSON payload inside the current generic business document model.

Reason:

- balance queries are read-heavy
- warehouse pages need fast filtering by product and warehouse
- future concurrency protection is easier on a dedicated balance record
- the generic business document table is better suited for auditable document history than hot balance lookups

### 6.4 Ledger Design

`inventory_ledger` should be append-only. Each confirmed movement creates new rows instead of mutating movement history.

Suggested movement types:

- `stock_in_confirmed`
- `stock_out_confirmed`
- `manual_adjust_increase`
- `manual_adjust_decrease`

---

## 7. Status Model

### 7.1 Stock-In Order Status

- `draft`
- `pending_confirmation`
- `confirmed`
- `cancelled`

### 7.2 Stock-Out Order Status

- `draft`
- `pending_confirmation`
- `confirmed`
- `cancelled`

### 7.3 Warehouse Master Status

- `active`
- `inactive`

Only active warehouses and active locations should be selectable in new warehouse documents.

---

## 8. Business Flows

### 8.1 Procurement Receiving Flow

1. purchase order is approved
2. operator creates stock-in order from purchase order
3. operator selects warehouse and location
4. operator confirms received quantities
5. system posts inventory increase into ledger and balance
6. purchase detail can show received quantity and stock-in status

### 8.2 Sales Fulfillment Flow

1. sales order enters fulfillment stage
2. operator creates stock-out order from sales order or shipment preparation
3. operator selects warehouse and location
4. system validates available quantity
5. operator confirms stock-out
6. system posts inventory decrease into ledger and balance
7. shipment batch continues external logistics after warehouse exit

### 8.3 Manual Adjustment Flow

1. warehouse manager or admin opens adjustment entry
2. operator chooses warehouse, location, product, quantity delta, and reason
3. system creates adjustment document and ledger rows
4. audit center records who changed stock and why

Manual adjustment is intentionally limited in phase one and should not replace normal inbound or outbound flows.

---

## 9. Key Rules

1. Unconfirmed stock-in must not increase inventory.
2. Unconfirmed stock-out must not decrease inventory.
3. Confirmed stock-out quantity cannot exceed available inventory.
4. Shipment batch should not represent warehouse stock deduction by itself; warehouse deduction happens at stock-out confirmation.
5. Cancelled stock documents must not change balances.
6. Every manual adjustment must require a human-readable reason.
7. Sales users can view warehouse-related status but cannot confirm warehouse movements unless explicitly granted warehouse actions later.

---

## 10. API Design

### Warehouse Master

- `GET /api/warehouses`
- `POST /api/warehouses`
- `PATCH /api/warehouses/:id`

### Location Master

- `GET /api/warehouse-locations`
- `POST /api/warehouse-locations`
- `PATCH /api/warehouse-locations/:id`

### Stock-In

- `GET /api/stock-in-orders`
- `POST /api/stock-in-orders`
- `GET /api/stock-in-orders/:id`
- `POST /api/stock-in-orders/:id/confirm`
- `POST /api/stock-in-orders/:id/cancel`

### Stock-Out

- `GET /api/stock-out-orders`
- `POST /api/stock-out-orders`
- `GET /api/stock-out-orders/:id`
- `POST /api/stock-out-orders/:id/confirm`
- `POST /api/stock-out-orders/:id/cancel`

### Inventory

- `GET /api/inventory/balances`
- `GET /api/inventory/ledger`

The API style should stay aligned with the existing controller + service + store pattern already used by procurement, shipment, and after-sales.

---

## 11. Page Map

| Route | Purpose |
|---|---|
| `/app/warehouses` | Warehouse and location entry |
| `/app/inventory` | Inventory balance center |
| `/app/stock-in` | Stock-in list |
| `/app/stock-in/[id]` | Stock-in detail |
| `/app/stock-out` | Stock-out list |
| `/app/stock-out/[id]` | Stock-out detail |

### Integration Points

- purchase order detail should link to stock-in creation and stock-in history
- sales order detail should link to stock-out creation and stock-out history
- shipment batch detail should show related stock-out document
- audit center should include warehouse operations

---

## 12. Permission Model

Phase one should stay simple and align with the current formal access structure.

Suggested action codes:

- `warehouse.manage`
- `inventory.view`
- `stock.in.confirm`
- `stock.out.confirm`
- `inventory.adjust`

Visibility expectations:

- `admin`: full access
- `boss`: view balances and warehouse status, no routine confirm
- `purchase` and `purchase_manager`: can view and participate in inbound flow
- `sales` and `sales_manager`: can view outbound readiness, but warehouse confirm should stay restricted
- later if a dedicated warehouse role is added, these actions can move there cleanly

---

## 13. Testing Strategy

The first batch should cover:

- warehouse and location page rendering
- stock-in creation and confirmation
- stock-out creation and confirmation
- insufficient inventory rejection
- balance projection after inbound and outbound confirmation
- ledger traceability to source purchase, sales, or shipment documents
- permission checks for confirm actions

Minimum critical business tests:

1. confirmed stock-in increases balance
2. confirmed stock-out decreases balance
3. cancelling a draft document does not affect balance
4. stock-out over available quantity is rejected
5. same product in different warehouses remains separated
6. ledger rows preserve source document references

---

## 14. Risks

1. If stock movements are mixed directly into shipment or purchase payloads, balance logic will become hard to maintain.
2. If balance projection is not isolated, later concurrency fixes will be expensive.
3. If outbound confirmation and shipment completion are treated as the same event, warehouse and logistics states will blur together.

This design avoids those risks by separating warehouse execution from external shipment progress while keeping source links intact.

---

## 15. Delivery Slice Recommendation

Implementation should proceed in narrow order:

1. data model and posting service
2. stock-in flow
3. stock-out flow
4. inventory balance and ledger pages
5. warehouse master pages
6. purchase / sales / shipment detail integration links

This order gives usable warehouse value quickly while keeping the first release stable and testable.
