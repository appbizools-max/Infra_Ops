# Phase 1 Plan: Multi-Modal Operations Corridor & Stockyard Management Engine

## Phase Objective
Implement the complete enterprise-grade backend and database schema for Stockyards, Material Piles, Multi-Modal Corridors, Transit Legs, and Asset/Crew Bindings, plus initial API endpoints.

## Tasks
1. **Database Schema Creation (`apps/backend/src/index.ts`):**
   - Create table `tenant_stockyards`: `(id, tenant_id, worksite_id, yard_name, yard_code, total_capacity_tons, location, supervisor_name, contact, status)`.
   - Create table `tenant_stockyard_piles`: `(id, tenant_id, stockyard_id, material_name, grade, unit_of_measure, current_quantity, min_threshold_quantity, bay_number)`.
   - Create table `tenant_stockyard_transactions`: `(id, tenant_id, stockyard_id, pile_id, transaction_type, quantity, project_id, vehicle_number, driver_name, waybill_number, remarks, created_at)`.
   - Create table `tenant_operations_corridors`: `(id, tenant_id, project_id, corridor_code, name, description, topology_type, status, created_at)`.
   - Create table `tenant_corridor_legs`: `(id, tenant_id, corridor_id, leg_sequence, origin_worksite_id, destination_worksite_id, transport_mode, distance_km, estimated_tat_hours, transshipment_required, created_at)`.
   - Create table `tenant_corridor_assets`: `(id, tenant_id, corridor_id, leg_id, asset_type, vehicle_id, equipment_id, driver_id, operator_name, shift, notes)`.
   - Create table `tenant_dispatch_waybills`: `(id, tenant_id, waybill_number, project_id, corridor_id, origin_worksite_id, destination_worksite_id, origin_stockyard_id, destination_stockyard_id, material_name, gross_weight, tare_weight, net_weight, vehicle_number, driver_name, driver_phone, status, dispatched_at, received_at)`.
2. **REST Endpoints (`apps/backend/src/index.ts`):**
   - Stockyard endpoints: `GET/POST /api/tenant/stockyards`, `GET/POST /api/tenant/stockyards/:id/piles`, `GET /api/tenant/stockyard-transactions`.
   - Operations Corridor endpoints: `GET/POST /api/tenant/operations-corridors`, `GET/POST /api/tenant/operations-corridors/:id/legs`, `POST /api/tenant/operations-corridors/:id/assets`.
   - Dispatch Waybill endpoints: `GET/POST /api/tenant/dispatch-waybills`, `POST /api/tenant/dispatch-waybills/:id/receive` (updates stockpile quantities automatically).
3. **Verification:**
   - Verify server boot and auto-table creation without syntax or runtime errors.
