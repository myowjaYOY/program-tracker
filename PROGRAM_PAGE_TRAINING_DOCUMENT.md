# Program Page Training Document

## Overview
The Programs page is the central hub for managing member programs in the system. It provides comprehensive functionality for tracking program details, financials, payments, items, tasks, and execution schedules. This document serves as a complete training guide for end users to understand and effectively utilize all program management features.

---

## 1. Business Rules Documentation

### 1.1 Program Status Management

#### Status Transition Rules
- **Quote → Active**: Requires a Start Date and at least one payment to be configured
- **Active → Paused**: Shows confirmation dialog warning that incomplete script items and tasks will be put on hold
- **Paused → Active**: Shows confirmation dialog explaining that incomplete items will be shifted forward by the pause duration
- **Completed/Cancelled**: Cannot transition to any other status - these are terminal states
- **Any → Completed/Cancelled**: Blocked - programs in these states cannot change status

#### Status-Based Restrictions
- **Quote Status**: Full editing capabilities for all tabs
- **Active Status**: 
  - Financials and Items tabs become locked (read-only)
  - Script and ToDo tabs remain editable for completion tracking
  - Tasks tab remains editable for task management
- **Paused Status**: Read-only for all tabs except completion tracking
- **Completed/Cancelled Status**: All tabs become read-only

### 1.2 Financial Management Rules

#### Program Price Calculation
- **Total Charge**: Sum of all item charges (calculated from Items tab)
- **Finance Charges**: Can be positive (included in Program Price) or negative (affects margin)
- **Discounts**: Always negative values (reductions from Total Charge)
- **Program Price**: Total Charge + Finance Charges + Discounts
- **Taxes**: For reference only, not included in Program Price
- **Margin**: Calculated as (Program Price - Total Cost) / Program Price × 100

#### Margin Color Coding
- **Green (≥80%)**: Healthy margin
- **Orange (≥75% and <80%)**: Acceptable margin
- **Red (<75%)**: Low margin requiring attention

#### Payment Generation Rules
- Payments are automatically created/updated when:
  - Financing Type changes
  - Finance Charges change
  - Discounts change
  - Program Price changes (from Items tab modifications)
- If any payment is already marked as Paid, the schedule will not be replaced
- Financial changes save successfully but show notice that payments weren't updated

### 1.3 Items Management Rules

#### Editing Restrictions
- **Quote Status**: Direct editing allowed
- **Non-Quote Status**: Must use "Enter Edit Mode" for staged changes
- **Edit Mode**: Changes are staged until "Apply Changes" is clicked
- **Used Items**: Cannot delete items that have been used (used_count > 0)

#### Financial Impact Validation
- Changes to items trigger price and margin validation
- System compares projected values against locked financial values
- Apply button only enabled when projected values match locked values within tolerance
- Tolerance: 1 cent for price, 0.1% for margin

### 1.4 Schedule Generation Rules

#### Prerequisites for Schedule Generation
- Program must be in "Active" status
- Program must have a Start Date
- All unsaved changes must be saved first

#### Schedule Generation Effects
- Creates scheduled instances for all program items
- Generates task schedules based on item timing
- Updates Script and ToDo tabs with new schedules
- Invalidates and refreshes related data

### 1.5 Data Validation Rules

#### Required Fields
- **Program Name**: Must be provided
- **Member**: Must be selected from active leads
- **Start Date**: Required when status is "Active"

#### Field Constraints
- **Taxes**: Must be non-negative
- **Discounts**: Must be negative (system enforces this)
- **Finance Charges**: Can be positive or negative
- **Quantity**: Must be positive integers
- **Days from Start**: Must be non-negative integers
- **Days Between**: Must be non-negative integers

---

## 2. Object Usage Guide

### 2.1 Programs Grid

#### Purpose
The Programs Grid displays all member programs in a searchable, sortable table format.

#### Key Features
- **Search Functionality**: Filter programs by name, member, or status
- **Status Indicators**: Visual status badges with color coding
- **Member Information**: Displays member name and contact details
- **Financial Summary**: Shows program price and payment status
- **Selection**: Click any row to select and view program details

#### Usage Steps
1. Use the search bar to filter programs by name or member
2. Click on any program row to select it
3. Selected program details will appear in the tabs below
4. Use column sorting to organize the view

### 2.2 PROGRAM Tab

#### Purpose
Manages basic program information and core settings.

#### Required Inputs
- **Program Name**: Descriptive name for the program
- **Member**: Selected from dropdown of active leads
- **Status**: Current program status (Quote, Active, Paused, Completed, Cancelled)
- **Start Date**: Required when status is Active
- **Description**: Optional detailed description
- **Active Flag**: Toggle for program activation

#### Usage Steps
1. **Edit Program Details**:
   - Modify any editable field
   - System validates required fields based on status
   - Save button activates when changes are made

2. **Generate Schedule**:
   - Click "Generate Schedule" button (only available when Active with Start Date)
   - System creates scheduled instances for all items
   - Confirmation message appears on success

3. **Status Transitions**:
   - Select new status from dropdown
   - System shows confirmation dialogs for certain transitions
   - Review warnings before confirming changes

#### Business Rules Applied
- Start Date required for Active status
- At least one payment required before activation
- Status transition confirmations for Active ↔ Paused
- Blocked transitions from Completed/Cancelled states

### 2.3 Financials Tab

#### Purpose
Manages program pricing, financing, and financial calculations.

#### Key Components
- **Total Cost**: Read-only, calculated from item costs
- **Total Charge**: Read-only, calculated from item charges
- **Margin**: Read-only, color-coded based on percentage
- **Financing Type**: Dropdown selection for payment structure
- **Finance Charges**: Can be dollar amount or percentage
- **Discounts**: Always negative, can be dollar amount or percentage
- **Program Price**: Calculated total excluding taxes
- **Taxes**: For reference only
- **Remaining Balance**: Program Price minus total paid

#### Usage Steps
1. **Set Financing Type**:
   - Select from dropdown (required for Finance Charges)
   - "None" option available for no financing

2. **Enter Financial Adjustments**:
   - **Finance Charges**: Enter amount or percentage (e.g., "5%")
   - **Discounts**: Enter amount or percentage (e.g., "10%")
   - **Taxes**: Enter dollar amount

3. **Review Calculations**:
   - Program Price updates automatically
   - Margin color indicates financial health
   - Remaining Balance shows outstanding amount

4. **Save Changes**:
   - Click "Save and Update Payments"
   - System updates payment schedule if applicable
   - Success message confirms save

#### Business Rules Applied
- Finance Charges can be positive or negative
- Discounts must be negative (system enforces)
- Taxes must be non-negative
- Payment schedule updates when financial changes occur
- Locked when status is not Quote or when payments exist

### 2.4 Payments Tab

#### Purpose
Displays and manages payment schedule and payment records.

#### Key Features
- **Due Date**: When payment is scheduled
- **Paid Date**: When payment was received (if applicable)
- **Amount**: Payment amount
- **Status**: Payment status (Pending, Paid, etc.)
- **Method**: Payment method used
- **Reference**: Payment reference number
- **Notes**: Additional payment notes

#### Usage Steps
1. **View Payment Schedule**:
   - Table shows all scheduled payments
   - Green status indicates paid payments
   - Red status indicates overdue payments

2. **Edit Payment Records** (Quote/Active status only):
   - Click edit button on any payment row
   - Update payment details in modal form
   - Save changes to update payment record

#### Business Rules Applied
- Read-only when program status is Paused, Completed, or Cancelled
- Can edit when status is Quote or Active
- Payment schedule auto-updates when financials change

### 2.5 Items Tab

#### Purpose
Manages the therapies and services included in the program.

#### Key Components
- **Therapy Type**: Category of therapy
- **Therapy Name**: Specific therapy or service
- **Bucket**: Organizational grouping
- **Quantity**: Number of sessions/units
- **Days After Start**: When to begin this item
- **Days Between**: Interval between sessions
- **Instructions**: Special instructions for delivery
- **Cost/Charge**: Financial impact per unit

#### Usage Steps

##### Direct Editing (Quote Status)
1. **Add Item**:
   - Click "Add Item" button
   - Select therapy from dropdown
   - Enter quantity and timing details
   - Add instructions if needed
   - Save to add to program

2. **Edit Item**:
   - Click edit icon on any item row
   - Modify details in edit modal
   - Save changes

3. **Delete Item**:
   - Click delete icon on item row
   - Confirm deletion
   - Cannot delete items that have been used

##### Staged Editing (Non-Quote Status)
1. **Enter Edit Mode**:
   - Click "Enter Edit Mode" button
   - All changes become staged until applied

2. **Make Changes**:
   - Add, edit, or delete items as needed
   - System shows preview of financial impact
   - Changes counter shows number of modifications

3. **Review Financial Impact**:
   - System displays locked vs. projected prices/margins
   - Green indicators show acceptable changes
   - Red indicators show problematic changes

4. **Apply Changes**:
   - Click "Apply Changes" when projections match locked values
   - System validates financial impact
   - Changes are committed to database

#### Business Rules Applied
- Cannot delete items that have been used
- Financial impact validation for staged changes
- Edit mode required when program is locked
- Automatic schedule regeneration after changes

### 2.6 Tasks Tab

#### Purpose
Manages individual tasks associated with program items.

#### Key Features
- **Therapy Type/Name**: Associated therapy
- **Task Name**: Specific task description
- **Description**: Detailed task instructions
- **Delay**: Days to delay task execution
- **Status**: Completed or Pending
- **Completed Date**: When task was finished
- **Completed By**: Who completed the task

#### Usage Steps
1. **View Tasks**:
   - Table shows all tasks for program items
   - Color-coded status indicators
   - Delay information shows timing adjustments

2. **Edit Task**:
   - Click edit icon on any task row
   - Modify delay, description, or completion status
   - Save changes

3. **Mark Completion**:
   - Toggle completion switch in edit modal
   - System records completion date and user
   - Task status updates immediately

#### Business Rules Applied
- Tasks are automatically generated from program items
- Can modify timing and descriptions
- Completion tracking with audit trail
- Read-only when program is locked

### 2.7 Script Tab

#### Purpose
Shows the execution schedule for program items.

#### Key Features
- **Scheduled Date**: When item should be delivered
- **Therapy Type/Name**: What is being delivered
- **Instance**: Which occurrence (1st, 2nd, etc.)
- **Completed**: Whether item was delivered

#### Usage Steps
1. **View Schedule**:
   - Table shows all scheduled item deliveries
   - Chronological order by scheduled date
   - Instance numbers show sequence

2. **Mark Completion**:
   - Click completion chip or icon
   - System toggles completion status
   - Visual feedback shows completion state

#### Business Rules Applied
- Read-only when program is Quote, Paused, Completed, or Cancelled
- Can mark completion when program is Active
- Schedule auto-updates when items change
- Generated from program items and timing

### 2.8 ToDo Tab

#### Purpose
Shows task schedule and completion tracking.

#### Key Features
- **Due Date**: When task should be completed
- **Therapy Type/Name**: Associated therapy
- **Task**: Specific task name
- **Description**: Task details
- **Completed**: Completion status

#### Usage Steps
1. **View Task Schedule**:
   - Table shows all scheduled tasks
   - Due dates based on program start and item timing
   - Task descriptions for guidance

2. **Mark Task Complete**:
   - Click completion chip or icon
   - System records completion
   - Visual indicators update immediately

#### Business Rules Applied
- Read-only when program is Quote, Paused, Completed, or Cancelled
- Can mark completion when program is Active
- Schedule auto-updates when items or tasks change
- Generated from program items and task timing

---

## 3. Training-Focused Explanations

### 3.1 Getting Started with Programs

#### Understanding the Program Lifecycle
Programs follow a clear lifecycle from creation to completion:

1. **Quote Phase**: Initial setup and configuration
   - Set program details and select member
   - Add therapies and services (Items)
   - Configure pricing and financing
   - Generate initial payment schedule

2. **Active Phase**: Program execution
   - Member begins receiving services
   - Track completion of scheduled items (Script)
   - Monitor task completion (ToDo)
   - Update payment records as received

3. **Paused Phase**: Temporary suspension
   - All editing becomes read-only
   - Completion tracking remains available
   - Program can be reactivated later

4. **Completed/Cancelled Phase**: Program conclusion
   - All editing becomes read-only
   - Historical data preserved for reporting

#### Best Practices for Program Management

**Initial Setup**:
- Always start in Quote status for full editing capabilities
- Complete all Items configuration before setting financials
- Generate schedule only after all items are finalized
- Review payment schedule before activating program

**Ongoing Management**:
- Regularly update Script tab as items are completed
- Mark tasks complete in ToDo tab for accurate tracking
- Record payments promptly in Payments tab
- Use status transitions appropriately (Active ↔ Paused)

**Financial Management**:
- Monitor margin percentages for program profitability
- Use Finance Charges for positive adjustments to pricing
- Use Discounts for customer concessions
- Review payment schedule after any financial changes

### 3.2 Common Workflows

#### Creating a New Program
1. Navigate to Programs page
2. Select a program from the grid or create new one
3. In PROGRAM tab:
   - Enter program name
   - Select member from dropdown
   - Set status to "Quote"
   - Add description if needed
4. In Items tab:
   - Add all required therapies/services
   - Set quantities and timing
   - Review total costs and charges
5. In Financials tab:
   - Set financing type if applicable
   - Add any finance charges or discounts
   - Review final program price and margin
   - Save financial changes
6. Return to PROGRAM tab:
   - Set start date
   - Change status to "Active"
   - Generate schedule
   - Save all changes

#### Managing an Active Program
1. Daily: Check Script tab for scheduled items
2. Mark items complete as they are delivered
3. Check ToDo tab for pending tasks
4. Mark tasks complete as they are finished
5. Weekly: Review payment status in Payments tab
6. Record payments as they are received
7. Monthly: Review program progress and financial status

#### Handling Program Changes
1. For minor adjustments (Active status):
   - Use Edit Mode in Items tab for staged changes
   - Review financial impact before applying
   - Apply changes when projections are acceptable

2. For major changes:
   - Consider pausing program temporarily
   - Make changes in Quote status if possible
   - Reactivate when changes are complete

#### Program Completion
1. Mark all remaining Script items as complete
2. Complete all pending tasks in ToDo tab
3. Ensure all payments are recorded
4. Change status to "Completed"
5. Review final program summary

### 3.3 Troubleshooting Common Issues

#### Program Won't Activate
- **Check**: Start Date is set
- **Check**: At least one payment exists
- **Check**: All required fields are completed
- **Solution**: Complete missing requirements in PROGRAM tab

#### Can't Edit Financials
- **Check**: Program status is Quote
- **Check**: No payments have been marked as Paid
- **Solution**: Change status to Quote or contact administrator

#### Items Changes Not Applying
- **Check**: Using Edit Mode for non-Quote programs
- **Check**: Financial projections match locked values
- **Solution**: Review financial impact and adjust changes

#### Schedule Not Generating
- **Check**: Program status is Active
- **Check**: Start Date is set
- **Check**: No unsaved changes exist
- **Solution**: Save changes and ensure prerequisites are met

#### Payments Not Updating
- **Check**: Some payments may already be marked as Paid
- **Solution**: System saves financials but preserves existing paid payments

### 3.4 Tips for Efficient Program Management

#### Navigation Tips
- Use the search function in Programs Grid to quickly find programs
- Click on any program row to select and view details
- Use tabs to navigate between different aspects of program management
- Save changes frequently to avoid data loss

#### Data Entry Tips
- Use percentage notation (e.g., "10%") for discounts and finance charges
- Enter detailed instructions for complex therapies
- Set realistic timing for items (Days After Start, Days Between)
- Use descriptive program names for easy identification

#### Monitoring Tips
- Check margin colors regularly (Green = Good, Orange = Caution, Red = Attention)
- Monitor payment status and due dates
- Track completion rates in Script and ToDo tabs
- Review remaining balance in Financials tab

#### Reporting Tips
- Use completion status for progress reporting
- Monitor financial metrics for program profitability
- Track task completion for staff performance
- Review payment history for financial reconciliation

---

## Conclusion

The Programs page provides comprehensive tools for managing member programs from initial quote through completion. Understanding the business rules, proper object usage, and following established workflows will ensure effective program management and accurate tracking of member services and payments.

Key success factors:
- Follow the program lifecycle appropriately
- Use status transitions correctly
- Maintain accurate financial records
- Track completion systematically
- Apply changes through proper channels

For additional support or questions about specific functionality, consult with your system administrator or refer to the system documentation.
