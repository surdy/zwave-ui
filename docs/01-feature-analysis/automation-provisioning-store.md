# Automation, Provisioning & Store

Sources: `Scenes.vue` + `DialogSceneValue.vue`, `SmartStart.vue` + `QrReader.vue`, `ConfigurationTemplates.vue` + `TemplateWizard.vue` + `DialogApplyTemplate.vue`, `Store.vue`.

---

## 1. Scenes (🔵)
Value snapshots that can be activated (mainly for automation via MQTT).

- **Selector + list**: scene dropdown `"[id] name"`; table columns Value ID / Node / Label / Value / Timeout / Actions (`Scenes.vue:12-32, 157-164`).
- **New Scene** → prompt name → `_createScene` (`:33-40, 216-239`).
- **Delete** (confirm) `:61-68` · **Activate** → `_activateScene` `:69-76`.
- **New Value** → `DialogSceneValue`: choose Node → writable Value → edit via `ValueId` → **Timeout** (seconds; 0 = immediate) → Save (`DialogSceneValue.vue:13-98`). Table shows `After Ns` / `No`.
- **Edit / delete** scene values via row actions (`:93-109, 271-311`).
- **Import** (overwrites all) / **Export** JSON (`:47-56, 168-200`).

---

## 2. Smart Start (🟢 — the modern, user-friendly inclusion path)
QR/DSK provisioning. This is the flow we want to make the **front door** for adding devices.

- **Table** "Provisioning Entries": ID, Name, Location, Active, Protocol, DSK, S2 Access Control, S2 Authenticated, S2 Unauthenticated, S0 Legacy, Manufacturer, Label, Description, Actions (`SmartStart.vue:35-52`).
- **FAB actions**: Add, **Scan**, Refresh, Import, Export (`:275-307`).
- **QR reader** (`QrReader.vue`): three tabs — **Scan** (camera select, "Small QR-Code" toggle, live video), **Import** (image upload / drag-drop), **Text** (paste QR string + Confirm) (`:3-145`).
- **Manual add/edit**: Name, Location, DSK (required — "DSK is required"), Protocol, the four security-class checkboxes (`:488-635`).
- **Activation**: `Active` switch per row (`:75-82`). Once a node is associated, security classes & protocol lock.
- **Protocol** toggle: Z-Wave ↔ Z-Wave Long Range (`:84-104`).
- **Remove entry**: confirm warns removal ≠ exclusion (`:187-198`).
- **Bulk**: search/filter + Import/Export JSON provisioning list (`:400-429`).

> Why it matters: Smart Start lets a user scan a QR code and have the device join securely and automatically when powered on — **no inclusion-mode timing dance, no manual DSK typing**. The rework should make "Scan a QR code" the primary, prominent "Add device" action.

---

## 3. Configuration Templates (🔵)
Reusable config-parameter profiles applied to matching devices.

- **List**: Create Template / Import / Export; columns Name, Device, Firmware Range, Values, Auto-Apply, Devices, Created, Actions (`ConfigurationTemplates.vue:43-176`).
- **TemplateWizard** stepper: **Select Device → Select Parameters → Name & Settings** (min/max firmware, "Auto-apply to new matching devices") (`TemplateWizard.vue:9-17, 329-405`).
- **Apply** → `DialogApplyTemplate` "Apply Template: <name>": multi-select table (Node / Product / Status / Details); Run / Cancel / **Retry Failed**; per-node status pending/running/success/warning/error (`DialogApplyTemplate.vue:2-207, 289-357`).
- Import/export `configuration_templates.json` (`:265-301`).

---

## 4. Store — persistent file manager (🔴)
Browse/edit the backend `store` folder.

- **Tree browser** (lazy-loaded folders); empty state "Please select a file" (`Store.vue:11-24`).
- **Folder menu**: New Folder, New File, Delete, Upload File; **file**: Delete (`:39-99`).
- **Editor**: `prism-editor` with SAVE / DOWNLOAD, Ctrl+S; new file prompts name, existing confirms overwrite (`:139-168, 530-599`).
- **Upload / download**: upload file, download current, download selected as zip (`:388-417`).
- **Backup / restore**: FAB Restore / Backup / Refresh; backup → `store-backup_<ts>.zip`; restore uploads zip with `restore=true` (`:278-321, 433-488`).

---

## 5. Import / export & backup recap
| Area | Export | Import / Restore |
|---|---|---|
| Settings | Export settings | Import settings |
| Scenes | `scenes` JSON | Import (overwrites) |
| Smart Start | provisioning JSON | Import JSON |
| Config Templates | `configuration_templates.json` | Import JSON |
| Store | per-file / selected zip / **full store backup zip** | Upload / **restore zip** |
| Controller | `nodes.json` dump, **NVM backup** | NVM restore |

---

## Rework implications
- **Smart Start QR scan** becomes the hero "Add device" action; classic inclusion is the fallback.
- **Scenes** and **Configuration Templates** are power features — group them under an "Automation / Advanced" area, not the main path.
- **Store** and raw **import/export** are expert utilities — keep them but de-emphasize. Surface friendly **Backup & Restore** (NVM + store) as a clearly labeled safety feature, since the catalog shows backups are scattered across Settings, Store, and the controller actions dialog today.
