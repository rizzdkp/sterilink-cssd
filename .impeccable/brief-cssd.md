# Surface brief: /cssd Antrean Kerja

Scope: route `/cssd` (work queue) and `/cssd/batches/[code]` (batch evidence). Visitor mode: Operate.
Audience and job: CSSD station staff and quality reviewers finding the batch that blocks the flow, then opening the one permitted next action.
Constraints: visual world and composition are pinned by `CSSD-Master/DESIGN.md` and the owner-approved 1586 x 992 mockup. Synthetic data only, always labelled.

## Direction contract

THESIS: The queue is a bench, not a dashboard. One table of batches, one detail panel that states why the selected batch is where it is and offers a single next step. It refuses the stat-card row, charts, and activity feed that admin shells ship by default.

OWN-WORLD: Blue and silver from the sterile tray photograph: canvas #F9F9F8, white surfaces, silver #F3F6F9 table head, stroke #DCE4EC, ink #142136, action blue #005BAB. Four status tones only (wait, progress, pass, hold), each paired with a label and icon. Inter with tabular figures for codes and times. Radius 4/8/12.

STORY: The reader sees how many batches await a quality decision, scans the table by status, selects a batch, reads the blocking reason, and opens its evidence.

FIRST VIEWPORT: At 1586 x 992 everything fits without scroll. Sidebar 262 px. Header with breadcrumb, 36 px title, "Pindai kode" primary action at right. Banner 143 px tall, copy left, tray photo right. Below: queue column (tabs, filter toolbar, 10-row table, pagination) and a 389 px batch panel with status reason, metadata, five-step timeline, evidence list, note.

FORM: Brief-pinned composition (approved mockup). No concept roll was run because the request specifies the surface precisely; seed key: none. Code-led build, no image generation available. Signature interaction: selecting a batch code updates the panel and the URL together, so a scan, a link, and a click all land on the same state.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
