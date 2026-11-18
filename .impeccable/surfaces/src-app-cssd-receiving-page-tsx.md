---
version: 1
slug: "src-app-cssd-receiving-page-tsx"
primary_target: "src/app/cssd/receiving/page.tsx"
related_targets: ["src/app/cssd/batches/page.tsx","src/app/cssd/batches/[code]/page.tsx","src/app/cssd/stock/page.tsx","src/app/cssd/distributions/page.tsx","src/app/cssd/trace/page.tsx","src/app/cssd/recalls/page.tsx","src/app/cssd/recalls/[code]/page.tsx","src/app/cssd/admin/page.tsx"]
---

# Surface brief: CSSD workflow screens

Scope: `/cssd/receiving`, `/cssd/batches`, `/cssd/batches/[code]`, `/cssd/stock`, `/cssd/distributions`, `/cssd/trace`, `/cssd/recalls`, `/cssd/recalls/[code]`, `/cssd/admin`, `/cssd/packages/[code]/label`. Visitor mode: Operate.
Audience and job: one station role at a time (receiving, packing, machine, reviewer, warehouse, unit, supervisor, admin) completing the next step of a tray, package or batch, often gloved and with a barcode scanner.
Authority: these screens extend the owner-pinned Antrean Kerja world (`CSSD-Master/DESIGN.md`). Composition follows `CSSD-Master/01-WORKFLOWS.md` page map and `reference/workflow-research.md` wireframes (station queue, set inspection, batch verification, distribution and recall); no separate concept roll, because the brief pins both the world and the task structure.

## Direction contract

THESIS: Each screen is a station bench: the work waiting for this role, and the one action that moves it forward, inline next to the item. It refuses dashboards, stat tiles and modal forms; a rejection appears beside the field that caused it and keeps the operator's input.

OWN-WORLD: Same tokens, type, radii and four status tones as the queue. Lists of items use the queue's silver table-head grammar (packages, evidence, audit). Content runs at the full 1288 px measure under the header so header actions sit on the content edge. Card titles are 16/24 bold ink; action sub-sections 15/22 bold; field labels 12/16 secondary.

STORY: The operator sees what is waiting, acts on one item, gets a confirmation that survives the item moving to the next stage, and the item leaves their list.

FIRST VIEWPORT: Header (breadcrumb, title, role, work-waiting indicator) then the primary form or list for the role. Primary action buttons are the blue strong action; destructive choices (fail, reject, recall) are outlined in the hold tone.

FORM: Brief-pinned extension of the queue world, position 1 of 1; seed key: none (no roll, pinned by DESIGN.md and 01-WORKFLOWS.md). Signature interaction: inline action forms whose success is announced in one page-level status region, so confirmation is not lost when the acted-on row changes stage.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Decisions

- Header notification slot from DESIGN.md is implemented as a work-waiting indicator (count of items for the current role, linking to the screen where they are done). There is no separate notification system in scope.
- No expiry column on package pickers: shelf-life policy is not modelled yet (gate G2), so no value is invented.
