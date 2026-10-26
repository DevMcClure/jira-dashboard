# 0021. Custom date range

- **Status:** Accepted (supersedes 0009)
- **Date:** 26 Oct 2026
- **Phase:** Follow-up to F3

## Context
On 26 Oct 2026 the open question "Should the period picker get a custom date range now?" was answered **yes**. Until then, only the presets existed, and frozen reports pinned a preset's dates.

## Decision
- The period picker, both in the header and on Export, gains **"Custom range…"**. It opens a dialog with a two-month calendar. Days before the data starts and after the export's "now" are disabled. Nothing changes until **Apply**.
- **Range rules:**
  - A range is **whole local days, inclusive**: the start of the first day to the end of the last, capped at the export's "now".
  - The two days can be picked in either order.
  - A single day is charted by hour, like Today.
- **Labels:** a custom period is labelled by its dates ("12 Oct – 19 Oct", "between 12 Oct and 19 Oct") everywhere a preset's name would appear.
- **Editing:** while a custom range is active, a small calendar button next to the picker reopens the dialog.
- **Reports:**
  - A report with a custom period **always stores `from` / `to`**, even a live one, because a custom range is absolute by nature. Opening the report applies those dates.
  - "Explore from here" carries them into the user's own picker.
  - The report schema requires the dates whenever `period` is `custom`.
- **Loading new data:** picked dates belong to the dataset they were picked against, so loading new data resets a custom period to Today.