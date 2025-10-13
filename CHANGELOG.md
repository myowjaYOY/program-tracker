## v1.12.0 - Payments Dashboard (2025-10-13)

### Added
- Payments dashboard page under Admin → Payments with cards + data grid.
- Metrics cards:
  - Total Amount Owed (unpaid, Active/Paused programs).
  - Amount Paid This Month (by paid date, all programs; new text/description).
  - Total Amount Late (unpaid overdue, Active/Paused) with member breakdown tooltip.
  - Members with Payments Due (distinct members with unpaid due today, Active/Paused).

### Changed
- Member dropdown uses same Active/Paused filter as Coordinator.
- Grid defaults to Due Date ascending; "Hide completed" removes Paid rows; Method column removed; Notes column added; Member Name column width reduced; Updated By shows full name/email.

### Fixed
- Normalized `payment_method_id` on updates (0 → null) to avoid FK violations.
- Updated API to set `updated_by` server‑side.

### API
- `GET /api/payments`: list payments with program and user enrichment; filters: `memberId`, `hideCompleted`.
- `GET /api/payments/metrics`: card metrics as specified (Card 2 uses paid date, all programs).
- `PUT /api/member-programs/:id/payments/:paymentId`: update with FK-safe normalization.
- `POST /api/member-programs/:id/payments/batch-update`: batch updates with normalization.


