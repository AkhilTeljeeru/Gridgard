# GridGuard AI — Verification Checklist

## Automated Verification
Run the automated verification suite, TypeScript linter, and production build:
1. `npm test` — Validates canonical ID equality (`id === canonicalId`), `source === "DEMO"` across all seed records, Indian substation voltage ratings (`132/33 kV`, `33/11 kV`), PostgreSQL & Neo4j schema/seed parity, 1:1 marker-to-details count parity, connected topology path resolution, and `"Not available"` formatting.
2. `npm run lint` — Runs `tsc --noEmit`.
3. `npm run build` — Runs `vite build`.

---

## Manual Verification — Part A (Single Source of Truth & Data Labeling)
- [ ] **Canonical IDs**: Select `SUB-TG-06U`, `FDR-TG-06U-01`, `CB-TG-06U-01`, `SW-TG-06U-14`, or `DTR-TG-06U-104` on the Grid Map and verify the exact same canonical ID appears in:
  - Map marker popup
  - Right-hand Asset Inspector panel
  - Knowledge Graph node & inspector
  - `/api/assets/SUB-TG-06U` and `/api/map/assets` responses
- [ ] **Source Badges**: Confirm every Map popup (assets, feeder lines, faults, maintenance, integrity issues), Details/Inspector panel, and Knowledge Graph node tooltip displays a visible `SourceBadge` (`DEMO`, `OSM`, `SIMULATED`, or `UTILITY`).
- [ ] **1:1 Count Parity**: Filter to `Telangana` -> `Hyderabad` -> `SUB-TG-06U`. Confirm Details Panel displays `Substations: 1`, `Feeders: 2`, `Transformers: 2`, `Breakers / SW: 2` matching the visible markers 1:1.
- [ ] **Missing Values ("Not available")**: Select `FDR-TG-07D-01` or `DTR-TG-07D-201` (or pan to un-tagged OSM features) and confirm missing inspection dates/tags render `"Not available"` (never `"N/A"`, `"Unknown"`, or fake `0`).
- [ ] **Indian Substation Voltages**: Inspect `SUB-TG-06U` (`132/33 kV`) and `SUB-TG-07D` (`33/11 kV`).

---

## Manual Verification — Part B (Bidirectional Map ↔ Knowledge Graph Sync)
1. Open **Grid Map** and enable **Split Sync: Map + Graph** in the header (or open **Knowledge Graph** and enable **Split Sync: Graph + Map**).
2. **Map → Graph**:
   - Click `DTR-TG-06U-104` marker on the Map.
   - Confirm the Knowledge Graph highlights `DTR-TG-06U-104` and its connected chain (`SUB-TG-06U` → `FDR-TG-06U-01` → `CB-TG-06U-01` / `SW-TG-06U-14` / `DTR-TG-06U-104`), dims unrelated nodes/edges, and centers on `DTR-TG-06U-104`.
3. **Graph → Map**:
   - Click `DTR-TG-07D-201` (or `SUB-KA-01U`) in the Knowledge Graph.
   - Confirm the Map smoothly executes `flyTo()` to the asset at zoom `>= 15`, opens its popup, and highlights its connected feeder/substation path without bouncing back.
4. **Search → Both**:
   - Search for `"CB-TG-06U-01"` or `"Indiranagar"` in the Grid Map search box and select a result.
   - Confirm **both** Map (`flyTo` + open popup) and Knowledge Graph (highlight + center + dim unrelated) update together.
5. **Bidirectional Hover**:
   - Hover a marker on the Map → corresponding node in the Knowledge Graph highlights.
   - Hover a node in the Knowledge Graph → floating tooltip appears with its `SourceBadge` and corresponding Map marker highlights.
6. **No Feedback Loops**:
   - Rapidly click markers and graph nodes back and forth; verify no ping-pong camera jumps or repeated re-centering occurs.

---

## Manual Verification — Grid Map ↔ Event Reconstruction Integration
- [ ] **Click Fault → Popup**: Click a red pulsing fault marker (`FLT-TG-06U-01`, `FLT-KA-01U-01`, or `FLT-MH-01U-01`) or click an item in **Active Alerts**; confirm map flies to the fault, renders its fault radius `<Circle>`, opens its popup showing Fault ID, Affected Feeder, Affected Transformer(s), Time Detected, Severity, Current Status, `SourceBadge` (`DEMO`), **"View Event Reconstruction"**, and **"Open Knowledge Graph"**.
- [ ] **View Event Reconstruction → Timeline Opens with Map**: Click **"View Event Reconstruction"** inside the fault popup (or **"Timeline →"** in Active Alerts); confirm the **Event Reconstruction** view opens with the corresponding fault's ordered cascade steps alongside the read-only mini-map and shaded affected area polygon (`fitBounds` framed around all affected assets) plus `"Open full Grid Map"` link.
- [ ] **Play → Sequence Animates**: Click **Play** (and test **Pause**, **Step Back**, **Step Forward**, **Speed** `0.5x`/`1x`/`2x`); confirm affected assets animate in chronological order from Normal (green) → Transient (amber) → Faulted (red), the feeder polyline pulses smoothly (unless `prefers-reduced-motion` is enabled), and `affectedConsumersCount` shows `"Not available"` for `FLT-MH-01U-01`.
- [ ] **Click a Step → Asset Highlighted in Map and Graph**: Click any timeline step (e.g. `CB-TG-06U-01` or `DTR-TG-06U-104`); confirm the asset is highlighted on the mini-map and in the shared `selectedAssetId` store (switching to **Knowledge Graph** or clicking **"Knowledge Graph"** centers and highlights that canonical asset).

