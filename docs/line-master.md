# Line Master

Site-owned manufacturing master using native Frappe permissions and audit history. Factory, Floor, Area and Line No are required trimmed text. Serial No is the immutable generated document name LM-00001, LM-00002, etc. No seed records or delete action.

System Manager has Read/Create/Write; Guest is denied. Master > Line Master opens /logicx-app/line-masters. List and Show use GET /api/resource/Line Master and /{name}; New uses POST; Edit uses PUT /{name}. Browser routes are /line-masters, /line-masters/{name}, /line-masters/new and /line-masters/{name}/edit under /logicx-app.

List provides serial and business columns, search, sort, columns, pagination, Refresh and View/Edit. New/Edit share header Save/Cancel, required validation, shortcut and dirty warnings following General Master. Save opens Show; Cancel returns to list. Native REST permissions apply to every operation. No new relationship tables or infrastructure.

Local commands: node .container/dev.mjs migrate-line-master (ownership check, backup and migration), verify-line-master (rolled-back CRUD, sequential serial, required fields, Guest denial), and assets (rebuild interface).
