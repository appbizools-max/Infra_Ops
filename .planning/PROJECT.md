# InfraOps360 - Multi-Modal Operations Corridor & Stockyard Management Engine

## Project Vision & Objective
Empower infrastructure, EPC, mining, and highway logistics companies on InfraOps360 to bridge Commercial Projects, Field Worksites, Stockyard Inventory, and Fleet Management (FMS) into a unified operational command center.

Operations Managers and Logistics Heads can design flexible **Operations Sketches / Corridors** (1-to-N, N-to-1, and Multi-Modal Relay: Road ➔ Rail ➔ Road), assign dedicated vehicles, heavy earthmoving equipment, drivers, and operators, track material stockpiles across stockyards with live inflow/outflow, and record resource consumption (Diesel, Trips, HMR).

---

## Core System Architecture & Modules

### 1. Operations Sketch / Corridor Engine (`tenant_operations_corridors`, `tenant_corridor_legs`)
- **Corridor Topology:** Links to a commercial Project (`tenant_projects`).
- **Flexible Worksite Binding:**
  - Multiple Loading Points (Quarry Pits, Mines, Borrow Areas) ➔ Single Processing/Unloading Point.
  - Single Source (Port, Siding) ➔ Multiple Unloading Points (Highway Sectors, Ready-mix Plants).
  - Multi-Modal Relay with Transshipment Hubs (Point A ➔ Point B via Rail Rake; Point B ➔ Point C via Road Tipper Trucks).
- **Leg-Level Configuration:** Transport Mode (`road`, `rail`, `conveyor`, `waterway`), Distance (KM), Planned TAT, Lead Times, Allowable Transit Shrinkage (%).

### 2. Stockyard & Material Inventory Engine (`tenant_stockyards`, `tenant_stockyard_piles`, `tenant_stockyard_transactions`)
- **Stockyard Profiles:** Capacity, Coordinates, Weighbridge calibration, Geofenced yard boundary.
- **Stockpile / Bay Segregation:** Material grades (e.g., GSB, 40mm Ballast, 10-20mm Aggregate, M-Sand, Coal/Iron Ore), Safe Min/Max thresholds, Current Tonnage / CUM.
- **Ledger Inward / Outward:** Real-time stock deductions upon dispatch slip creation, and additions upon gate weighbridge confirmation.

### 3. FMS Fleet & Heavy Equipment Integration (`tenant_corridor_asset_assignments`)
- **Mobile Fleet:** Multi-Axle Trucks, 10-Wheeler Tippers, Low-bed Trailers assigned to transit legs + primary drivers.
- **Stationary / Yard Heavy Equipment:** Hydraulic Excavators, Wheel Loaders, Cranes, Stackers assigned to specific loading/unloading worksites/sidings + licensed operators.
- **Dual Telemetry / Utilization:** KM & Fuel per KM (Trucks) vs HMR (Hour Meter Readings) & Fuel per Hour (Excavators/Loaders).

### 4. Project 360° Operations Command & Staff/Fleet Roster (`/tenant/project-management/:id`)
- **Complete A-to-Z Project Dossier:**
  - **Operations Corridor Sketch:** Visual route blueprint showing worksites, stockyards, and multi-modal legs linked to the project.
  - **Assigned Fleet & Heavy Machinery:** Real-time inventory of all tippers, trucks, excavators, and loaders committed to this project.
  - **Assigned Staff & Crew Roster:** Project Heads, site supervisors, primary drivers, and equipment operators with phone contacts.
  - **Fuel & Running Expense Ledger:** Diesel issued (liters), fuel costs, mileage (KM/L), and equipment consumption (L/HMR) automatically rolled into Project P&L.
  - **Material & Stockyard Balances:** Inflow/outflow of contracted aggregate/ore quantities against contract targets.

### 5. FMS Fleet Portal & Live Running Process Linkage (`/tenant/fms-employee` & `/tenant/fleet-operations`)
- **Live Corridor Transit Status:**
  - Displays each vehicle's active project, assigned corridor leg (e.g., *Mine Pit 1 ➔ Siding B*), current trip status (*At Loading Pit*, *En Route Rail Siding*, *Weighbridge Scale*, *Completed*).
  - Quick shift log: Driver login, vehicle inspection, odometer/HMR start-end, fuel vouchers issued.
  - Seamless inter-linking: Any asset assignment in the Operations Corridor instantly synchronizes with the driver's portal and fleet operations hub.

### 6. Dispatch Waybills & Material Passports (`tenant_dispatch_waybills`)
- **Digital Dispatch Slips:** Origin Worksite ➔ Transporter/Vehicle ➔ Driver ➔ Tare Weight ➔ Gross Weight ➔ Net Material Weight ➔ Destination Worksite.
- **Discrepancy & Shrinkage Audit:** Automatic alert if transit loss exceeds tolerance.
- **Resource Consumption Accounting:** Fuel issued, Trips logged, Operator shift handover.

---

## Technical Constraints & Standards
- **Backend:** Node.js + Express + PostgreSQL with raw SQL connection pooling (`pg`).
- **Frontend:** React + TypeScript + TailwindCSS + Lucide Icons.
- **Design System:** InfraOps360 Emerald Palette (`#00705a`), crisp slate cards, interactive SVG vector visualizer for multi-modal corridor sketches.
- **Multi-Tenancy:** Strict tenant isolation via `tenant_id`.
