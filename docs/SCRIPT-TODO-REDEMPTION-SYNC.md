# Script vs To-Do Redemption Mismatch

## What happened (Aubrey Moreno example)

- **Script list** shows some items as **redeemed** (`member_program_item_schedule.completed_flag = true`).
- **To-Do list** shows tasks for the **same** therapy instances as **not redeemed** (`member_program_items_task_schedule.completed_flag = null` or `false`).

The reverse can also occur: script **pending** but linked to-do tasks **redeemed**.

## Root cause

**Script** and **To-Do** use **two different tables and two different `completed_flag` columns**:

| List    | Table                              | Column        |
|---------|------------------------------------|---------------|
| Script  | `member_program_item_schedule`     | `completed_flag` |
| To-Do   | `member_program_items_task_schedule` | `completed_flag` |

They are **not kept in sync** by the app or the database:

1. **When marking an item redeemed in the Script tab**  
   The API only updates `member_program_item_schedule.completed_flag`.  
   It does **not** update `member_program_items_task_schedule.completed_flag` for the tasks linked to that schedule row (`member_program_item_schedule_id`).

2. **When marking a task completed in the To-Do tab**  
   The API only updates `member_program_items_task_schedule.completed_flag` for that task.  
   It does **not** update the parent `member_program_item_schedule.completed_flag`.

So a user can:
- Redeem in Script → script shows redeemed, to-dos for that instance stay pending.
- Complete in To-Do → to-do shows redeemed, script for that instance stays pending.

There are **no database triggers** that copy `completed_flag` between these two tables (only FK and audit triggers exist).

## Data proof (Aubrey Moreno, lead_id 915)

Query comparing script vs task_schedule by `member_program_item_schedule_id` shows **MISMATCH** rows, e.g.:

- Script **redeemed**, one linked task **pending**: `member_program_item_schedule_id` 43874, `member_program_item_task_schedule_id` 21811.
- Script **pending**, linked tasks **redeemed**: e.g. schedule 43877 (task 21815), 43878 (task 21816).

So “items not redeemed in the to-do list that belong to items in the script list that are redeemed” (and the opposite) are exactly this: script and to-do status updated independently with no sync.

## How to fix it

Two possible approaches:

### Option A: Sync in application (recommended short-term)

1. **When updating script** (`PUT .../schedule/[scheduleId]`):  
   After updating `member_program_item_schedule.completed_flag`, also update all rows in `member_program_items_task_schedule` with that `member_program_item_schedule_id` to the same `completed_flag` (so redeeming in Script marks all related to-dos redeemed).

2. **When updating to-do** (`PUT .../todo/[taskScheduleId]`):  
   After updating `member_program_items_task_schedule.completed_flag`, optionally:
   - If marking the task **redeemed** and **all** other tasks for the same `member_program_item_schedule_id` are already redeemed, set `member_program_item_schedule.completed_flag = true` for that schedule row.
   - If marking the task **pending/missed**, decide policy: either leave script as-is, or set script to pending when any task is no longer fully completed (policy choice).

### Option B: Sync in database (trigger)

Add a trigger on `member_program_item_schedule` (on UPDATE of `completed_flag`) that updates `member_program_items_task_schedule.completed_flag` for all rows with that `member_program_item_schedule_id`. Optionally a trigger on `member_program_items_task_schedule` that, when all tasks for a schedule are redeemed, sets the schedule’s `completed_flag` to true (and possibly the reverse for “un-redeem”).

Implementing Option A in the schedule and todo API routes will prevent new mismatches and can be combined with a one-time data fix to align existing rows for Aubrey and any other affected members.
