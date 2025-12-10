# Program Tracker - Feature Guide

Complete guide to all features in the Program Tracker application.

---

## 🏠 MAIN FEATURES

### 1. Dashboard

**Business Description:**
Central command center providing at-a-glance metrics for the entire organization. Shows active member count, new programs started this month, completed programs, and program changes activity. Allows quick access to individual member programs with detailed views of their information, items, notes, scripts, tasks, and change history.

**User Story:**
*As a manager, I want to see key business metrics and quickly access any member's program details so that I can monitor overall performance and respond to specific member needs.*

**How to Use:**
1. Log in to Program Tracker
2. Dashboard loads automatically (or click "Dashboard" in sidebar)
3. View four metric cards at the top:
   - **Active Members**: Current members on active programs
   - **New Programs This Month**: Programs started in current calendar month
   - **Completed Programs**: All-time completed program count
   - **Program Changes (This Week)**: Structural changes to programs (adding/removing items) made Sunday-Saturday
4. To view a specific member's program:
   - Click the "Select Member" dropdown
   - Choose a member from the list
   - If they have multiple programs, select the specific program
5. Use the tabs to view different aspects:
   - **PROGRAM**: Basic program details and status
   - **Items**: Therapies, supplements, and appointments
   - **Notes**: Member communication history
   - **Script**: Scheduled appointments and their status
   - **To Do**: Task list and completion tracking
   - **Changes**: Audit trail of all modifications

---

### 2. Coordinator

**Business Description:**
Operational hub for program coordinators to manage daily member interactions. Provides filtered views of script items (appointments) and todo tasks, showing what's late, due today, or upcoming. Includes member progress reports with health metrics and allows tracking of program modifications.

**User Story:**
*As a program coordinator, I want to see all my tasks and appointments organized by priority so that I can efficiently manage my daily workload and ensure no member is neglected.*

**How to Use:**
1. Click "Coordinator" in the main navigation
2. View the top metrics:
   - **Late Tasks**: Overdue todo items requiring immediate attention
   - **Tasks Due Today**: Todo items with today's due date
   - **Appointments Due Today**: Script items scheduled for today
   - **Program Changes (This Week)**: Recent program modifications
3. Use tabs to switch views:
   - **Script**: Appointment schedule for member visits
   - **To Do**: Task list for coordinator actions
   - **Program Changes**: History of program modifications
   - **Member Progress**: Health and compliance tracking
4. Filter options:
   - **Date Range**: Today, This Week, This Month, Custom Range, or All
   - **Member**: Filter to specific member or view all
   - **Show Completed**: Toggle to include/exclude completed items
   - **Hide Missed**: Remove past items that weren't completed
5. Complete items:
   - Click checkbox next to any item to mark complete
   - System automatically timestamps completion
6. View member progress:
   - Switch to "Member Progress" tab
   - Review health vitals, compliance metrics, and status indicators
   - Identify members needing attention (red/yellow status)

---

### 3. Order Items

**Business Description:**
Streamlined workflow for requesting, ordering, and receiving supplements, supplies, and equipment for members. Tracks the complete lifecycle from initial request through order placement to receipt confirmation. Provides visibility into pending requests, current month activity, and overdue items.

**User Story:**
*As a provider, I want to request items for my members and track their order status so that I can ensure they receive everything they need on time.*

**How to Use:**
1. Click "Order Items" in main navigation
2. Review metrics:
   - **Pending Requests**: Items requested but not yet ordered
   - **Ordered This Month**: Items ordered in current month
   - **Received This Month**: Items received in current month
   - **Overdue Requests**: Pending requests older than 30 days
3. **To create a new request:**
   - Click "Create New Request" button
   - Select the member who needs the item
   - Enter item description (e.g., "Vitamin D3 5000 IU")
   - Specify quantity (default 1)
   - Add any notes (optional)
   - Click "Submit"
4. **To order a pending request:**
   - Find the request in the table
   - Click "Mark as Ordered" action
   - Confirm the order date
   - System moves item to "Ordered" status
5. **To mark an item as received:**
   - Find the ordered item in the table
   - Click "Mark as Received" action
   - Confirm receipt date
   - System moves item to "Received" status
6. **Filter and search:**
   - Use status filter dropdown (All, Pending, Ordered, Received)
   - Search by member name or item description
   - Sort by clicking column headers

---

### 4. Report Card

**Business Description:**
Survey-based health tracking and reporting system that visualizes member progress through MSQ and PROMIS-29 assessments. Generates exportable PDF reports showing symptom improvements, health trajectory, and compliance metrics. Provides population-level analytics and individual member insights.

**User Story:**
*As a clinical director, I want to track member health outcomes through standardized surveys and generate professional reports so that I can measure program effectiveness and share results with members.*

**How to Use:**
1. Click "Report Card" in main navigation
2. View three main tabs:
   - **Individual Reports**: Per-member analysis
   - **Population Analytics**: Aggregate statistics
   - **Survey Import**: Upload new survey data
3. **Individual Reports:**
   - Select a participant from the dropdown (only shows members with survey data)
   - Choose date range for analysis
   - Review metrics:
     - MSQ domain improvements (symptom reduction)
     - PROMIS-29 health domains (physical/mental function)
     - Compliance percentages (nutrition, supplements, exercise)
   - Click "Export to PDF" to generate professional report
   - PDF includes:
     - Member name and date range
     - MSQ symptom scores with improvements
     - PROMIS-29 health scores
     - Compliance metrics
     - Health trajectory visualization
4. **Population Analytics:**
   - View aggregate statistics across all active members
   - Review correlation between compliance and health outcomes
   - Identify program-wide trends
   - Use insights for program improvements
5. **Survey Import:**
   - Click "Choose File" to select CSV export from survey system
   - Click "Upload and Process"
   - System processes in background
   - Receive notification when complete
   - Review import summary (new responses, errors, warnings)

---

## 📈 MARKETING FEATURES

### 5. Campaigns

**Business Description:**
Marketing campaign management for tracking lead generation events. Records campaign details, expected attendance, vendor partnerships, and associated costs (advertising spend, food costs). Links campaigns to leads generated, enabling ROI analysis.

**User Story:**
*As a marketing manager, I want to track all our lead generation campaigns with their costs and results so that I can calculate ROI and optimize future marketing spend.*

**How to Use:**
1. Navigate to Marketing > Campaigns
2. **Create a new campaign:**
   - Click "Create New Campaign"
   - Enter campaign name (e.g., "February Open House")
   - Select campaign date
   - Choose vendor/partner
   - Enter confirmed attendance count
   - Add description of campaign
   - Enter ad spend (optional)
   - Enter food/event costs (optional)
   - Click "Save"
3. **Edit existing campaign:**
   - Click "Edit" icon on any campaign row
   - Update any field
   - Click "Save"
4. **Deactivate campaign:**
   - Click "Delete" icon on campaign row
   - Confirm deactivation (campaign is archived, not deleted)
5. **View campaign leads:**
   - Campaign automatically links to all leads created for that campaign
   - See lead count in table
   - Click campaign to view associated leads

---

### 6. Leads

**Business Description:**
Complete lead and member management system tracking the entire customer lifecycle. Captures contact information, lead source (campaign), current status (New Lead, PME Scheduled, Sold, etc.), and tracks progression through the sales funnel. Includes note-taking for follow-ups, wins, challenges, and PME (phone medical evaluation) details.

**User Story:**
*As a sales representative, I want to manage my leads from first contact through program enrollment so that I can track my pipeline and ensure timely follow-up.*

**How to Use:**
1. Navigate to Marketing > Leads
2. **Add a new lead:**
   - Click "Add New Lead"
   - Enter first name and last name (required)
   - Enter phone number (required)
   - Enter email (optional)
   - Select campaign source
   - Select initial status (default: "New Lead")
   - Enter PME date if scheduled
   - Click "Save"
3. **Update lead status:**
   - Find lead in table
   - Click "Edit" icon
   - Update status dropdown:
     - New Lead → Initial contact made
     - PME Scheduled → Phone evaluation appointment set
     - Sold → Enrolled in program
     - Not Interested → Declined services
     - Lost to Competition → Went with another provider
   - Add PME date if applicable
   - Click "Save"
4. **Add notes to lead:**
   - Click lead name to open detail view
   - Click "Add Note" button
   - Select note type:
     - **PME**: Phone evaluation notes
     - **Follow-Up**: General follow-up notes
     - **Win**: Positive progress or success
     - **Challenge**: Issues or concerns
     - **Other**: Miscellaneous notes
   - Enter note content
   - Click "Save Note"
5. **Search and filter:**
   - Use search box to find by name
   - Filter by status using dropdown
   - Filter by campaign
   - Sort by clicking column headers

---

### 7. Marketing Reports

**Business Description:**
Analytics dashboard for marketing campaign performance. Shows lead generation metrics by campaign, conversion rates, cost per lead, and pipeline velocity. Helps identify most effective marketing channels and optimize budget allocation.

**User Story:**
*As a marketing director, I want to analyze campaign performance metrics so that I can allocate budget to the most effective lead generation channels.*

**How to Use:**
1. Navigate to Marketing > Reports
2. **Campaign Performance:**
   - View table showing all campaigns
   - See metrics per campaign:
     - Confirmed attendees (expected)
     - Actual leads generated
     - Conversion rate (leads ÷ attendees)
     - Ad spend
     - Cost per lead
     - Leads by status breakdown
3. **Filter by date:**
   - Select date range (This Month, Last Month, Quarter, Year, Custom)
   - Reports update automatically
4. **Export reports:**
   - Click "Export to CSV" for spreadsheet analysis
   - Click "Export to PDF" for presentation format
5. **Key metrics to track:**
   - Highest conversion rate campaigns (replicate success)
   - Lowest cost per lead (efficient spending)
   - High attendance but low conversion (fix messaging/targeting)
   - Pipeline velocity (time from lead to sale)

---

## 💰 SALES FEATURES

### 8. Programs

**Business Description:**
Comprehensive member program management system handling the entire customer lifecycle. Manages program creation from templates, customization of items and tasks, pricing and financial terms, payment tracking, and status progression (Quote → Active → Completed). Includes integrated audit trail and read-only enforcement for completed programs.

**User Story:**
*As a sales consultant, I want to create customized programs for members, track their payments and progress, and maintain accurate financial records so that I can deliver excellent service and ensure proper billing.*

**How to Use:**
1. Navigate to Sales > Programs
2. **Create a new program:**
   - Click "Create New Program"
   - Select member from dropdown (or create new lead)
   - Choose program template (pre-configured program type)
   - System copies template items, tasks, and RASHA sequences
   - Set program start date
   - Initial status is "Quote"
   - Click "Create Program"
3. **Program tabs overview:**
   - **Program**: Basic info, status, pricing summary
   - **Items**: Therapies, supplements, appointments
   - **Financials**: Pricing, taxes, finance charges, payments
   - **Payments**: Payment schedule and tracking
   - **Script**: Auto-scheduled appointment dates
   - **Tasks**: Auto-scheduled todo items
   - **RASHA**: RASHA frequency sequence
   - **Notes**: Program-specific notes
4. **Customize program items:**
   - Go to "Items" tab
   - Click "Add Item" to add therapies/supplements/appointments
   - Edit quantity, cost, charge for any item
   - Adjust timing: days_from_start, days_between
   - Add instructions for each item
   - Items automatically calculate into total pricing
5. **Manage financials:**
   - Go to "Financials" tab
   - Review auto-calculated totals:
     - Total Charge (sum of all items)
     - Taxes (8.25% on taxable items only)
     - Finance Charges (positive or negative)
     - Discounts (negative amount)
     - Final Total Price
   - Edit finance charges (positive adds to price, negative reduces it)
   - Edit discounts
   - View margin calculation (profit percentage)
   - Select financing type (Cash, Payment Plan, Insurance, etc.)
6. **Set up payments:**
   - Go to "Payments" tab
   - Click "Add Payment"
   - Enter payment amount
   - Set due date
   - System initially marks as "Pending"
   - As payments received:
     - Edit payment record
     - Change status to "Paid"
     - Enter actual payment date
     - Select payment method (Cash, Credit Card, Check, etc.)
     - Add reference number (check #, transaction ID)
7. **Change program status:**
   - Go to "Program" tab
   - Click status dropdown
   - Valid transitions:
     - **Quote → Active**: After payment received and financing type selected
     - **Quote → Cancelled**: If deal falls through
     - **Active → Paused**: Temporary break
     - **Active → Completed**: Program successfully finished
     - **Active → Cancelled**: Program terminated
     - **Paused → Active**: Resume after break
     - **Paused → Completed**: Complete without resuming
   - Status change to "Active" locks pricing
   - Status change to "Completed" or "Cancelled" makes program read-only
8. **View audit trail:**
   - Changes to programs are automatically tracked
   - View in Coordinator > Program Changes or Dashboard > Member view > Changes tab
   - See all modifications with timestamps and user who made them

---

### 9. Sales Reports

**Business Description:**
Revenue and pipeline analytics for sales performance tracking. Shows new programs created, total revenue booked, conversion rates from quote to active, average program value, and forecasting. Provides visibility into sales trends and individual performance.

**User Story:**
*As a sales manager, I want to track sales performance metrics and forecast revenue so that I can manage the team and predict business growth.*

**How to Use:**
1. Navigate to Sales > Reports
2. **Overview metrics:**
   - New Programs Created (by period)
   - Total Revenue Booked
   - Average Program Value
   - Quote to Active Conversion Rate
   - Programs by Status (pie chart)
3. **Filter options:**
   - Date range (Month, Quarter, Year, Custom)
   - Salesperson (if tracking individual performance)
   - Program status (All, Quote, Active, Completed)
4. **Revenue analysis:**
   - View revenue trends over time (line chart)
   - Compare actual vs projected revenue
   - See revenue by program type
   - Calculate close rate percentage
5. **Pipeline health:**
   - Current value of quotes in pipeline
   - Average time from quote to close
   - Aging analysis of quotes (identify stalled deals)
   - Forecast future revenue based on historical conversion
6. **Export options:**
   - Export to CSV for detailed analysis
   - Export to PDF for presentations
   - Schedule automated email reports

---

## 🏥 OPERATIONS FEATURES

### 10. Inventory Forecast

**Business Description:**
Proactive inventory planning tool that analyzes upcoming scheduled therapies and appointments to predict product needs. Calculates required quantities by month, identifies items to order, and flags cost increases to prevent budget surprises. Essential for maintaining adequate stock without over-ordering.

**User Story:**
*As an operations manager, I want to forecast monthly inventory needs based on scheduled treatments so that I can order the right quantities at the right time and avoid stockouts.*

**How to Use:**
1. Navigate to Operations > Inventory Forecast
2. **Select forecast period:**
   - Choose month/year from date picker
   - System analyzes all scheduled items for that month
3. **Review forecast table:**
   - **Therapy Name**: Product/service needed
   - **Total Needed**: Quantity required for month
   - **Current Stock**: Quantity on hand
   - **Need to Order**: Calculated difference
   - **Member Cost**: Price locked in member program
   - **Current Cost**: Current therapy cost (in therapies table)
   - **Cost Variance**: Flags when current > member cost (you'll lose money)
4. **Identify items to order:**
   - Look for "Need to Order" > 0
   - Note items highlighted in red (negative margin due to cost increases)
   - Create purchase orders for needed items
5. **Cost variance alerts:**
   - Red highlighted rows = current cost exceeds member's locked-in price
   - You'll lose money on these items
   - Options:
     - Absorb the loss (one-time issue)
     - Negotiate with vendor (if significant)
     - Document for future pricing adjustments
6. **Export forecast:**
   - Click "Export to CSV"
   - Share with purchasing team
   - Use for budget planning

---

### 11. Inventory Management

**Business Description:**
End-to-end inventory control system managing purchase orders, stock levels, and physical count reconciliation. Tracks the complete lifecycle: create PO → order from vendor → receive shipment → update stock. Includes reorder point alerts, variance approval workflow for counts, and full transaction audit trail.

**User Story:**
*As an inventory manager, I want to manage stock levels, process purchase orders, and perform physical counts so that I maintain accurate inventory and prevent stockouts.*

**How to Use:**
1. Navigate to Operations > Inventory Management
2. **Dashboard metrics:**
   - **Pending Approval**: POs waiting for manager approval
   - **Awaiting Receipt**: POs ordered but not received
   - **Low Stock Items**: Items below reorder point
   - **In-Progress Counts**: Active physical count sessions
   - **Pending Variance**: Count discrepancies needing approval
3. **Three main tabs:**
   - **Purchase Orders**: Create and track POs
   - **Inventory**: View stock levels and history
   - **Physical Count**: Perform cycle counts

#### A. Purchase Orders Tab
4. **Create a purchase order:**
   - Click "Create New PO"
   - System auto-generates PO number
   - Add items to PO:
     - Click "Add Item"
     - Select therapy from dropdown
     - Enter quantity to order
     - Enter unit cost (what vendor charges)
     - System calculates line total
   - Add multiple items as needed
   - Enter supplier information:
     - Supplier name
     - Contact info
   - Set expected delivery date
   - Add PO notes (optional)
   - Review subtotal, tax, shipping, total
   - Click "Save as Draft" or "Submit for Approval"
5. **PO workflow:**
   - **Draft**: Initial creation, can edit freely
   - **Pending Approval**: Submitted to manager
   - **Approved**: Manager approved, ready to order
   - **Ordered**: Sent to vendor, awaiting delivery
   - **Partially Received**: Some items received
   - **Received**: All items received, PO complete
   - **Cancelled**: PO cancelled before completion
6. **Receive items from PO:**
   - Find PO with status "Ordered"
   - Click "Receive Items"
   - For each line item:
     - Enter quantity received
     - Enter actual unit cost (if different)
     - Enter received date
   - If partial receipt, some items remain "Ordered"
   - When all items received, PO auto-closes
   - System automatically:
     - Updates inventory quantities
     - Creates inventory transactions
     - Calculates new weighted average cost

#### B. Inventory Tab
7. **View inventory levels:**
   - See all inventory items
   - **Columns:**
     - Therapy Name
     - Quantity On Hand (current stock)
     - Reorder Point (trigger for ordering)
     - Reorder Quantity (amount to order when hit reorder point)
     - Quantity On Order (incoming from POs)
     - Last Counted (physical count date)
   - **Low stock items**: Highlighted when Quantity On Hand < Reorder Point
8. **Edit reorder settings:**
   - Click "Edit" on any item
   - Adjust reorder point (when to reorder)
   - Adjust reorder quantity (how much to reorder)
   - System alerts when items drop below reorder point
9. **View transaction history:**
   - Click item name to view details
   - See all transactions:
     - **Purchase Receive**: Added from PO
     - **Dispensing**: Used for member (future feature)
     - **Adjustment**: Physical count correction
     - **Return**: Returned to vendor

#### C. Physical Count Tab
10. **Start a physical count:**
    - Click "Start New Count"
    - Select count type:
      - **Full Count**: Count all items
      - **Cycle Count**: Count all items (same as full)
      - **Custom Count**: Select specific items
    - Set session date
    - Add notes (optional)
    - Click "Start Count Session"
11. **Perform the count:**
    - System creates count session with all items
    - For each item, system shows:
      - Expected Quantity (what system thinks you have)
      - Physical Quantity (what you actually counted)
    - Walk through inventory with tablet/printout
    - Enter physical count for each item
    - System auto-calculates variance
12. **Variance approval workflow:**
    - System flags variances exceeding threshold (e.g., >5%)
    - These require manager approval
    - Manager reviews:
      - Item name
      - Expected vs Physical
      - Variance amount and percentage
      - Counter's notes
    - Manager approves or rejects each variance
    - Approved variances will adjust inventory
    - Rejected variances stay at system count (recount needed)
13. **Post the count:**
    - After all items counted and variances approved
    - Click "Post Count to Inventory"
    - System updates:
      - Inventory quantities to physical counts
      - Last counted date
      - Creates adjustment transactions
    - Count session moves to "Completed" status

---

### 12. Item Requests

**Business Description:**
Member-specific product request workflow for supplements, supplies, and equipment not included in their program. Tracks three-stage lifecycle: requested → ordered → received. Provides visibility into pending requests, fulfillment speed, and request patterns by member.

**User Story:**
*As a care coordinator, I want to request items for members outside their standard program and track their order status so that I can respond to member needs and ensure timely delivery.*

**How to Use:**
1. Navigate to Operations > Item Requests
2. **Metrics:**
   - **Pending Requests**: Need to be ordered
   - **Ordered This Month**: Order placed
   - **Received This Month**: Delivered to member
   - **Overdue Requests**: Pending > 30 days
3. **Create item request:**
   - Click "Create New Request"
   - Select member
   - Enter item description (free text - not limited to inventory)
   - Specify quantity (default: 1)
   - Add notes (brand preferences, member needs, etc.)
   - Click "Submit Request"
   - Status: "Pending"
4. **Order pending request:**
   - Find request in "Pending" status
   - Click "Mark as Ordered"
   - Enter ordered date
   - Add vendor/order details in notes (optional)
   - Status changes to "Ordered"
5. **Mark as received:**
   - Find request in "Ordered" status
   - Click "Mark as Received"
   - Enter received date
   - Status changes to "Received"
6. **Cancel a request:**
   - Find request
   - Click "Cancel" icon
   - Enter cancellation reason
   - Status changes to "Cancelled"
7. **Filter and search:**
   - Filter by status: All, Pending, Ordered, Received, Cancelled
   - Filter by member
   - Search by item description
   - Sort by any column

---

### 13. Program Analytics

**Business Description:**
Advanced analytics platform providing population-level insights into member health outcomes, compliance patterns, and program effectiveness. Correlates member compliance with survey improvements, identifies at-risk members, analyzes curriculum bottlenecks, and provides AI-powered recommendations. Research-grade statistics with confidence intervals and correlation analysis.

**User Story:**
*As a clinical director, I want to analyze program outcomes across all members so that I can identify what's working, what's not, and make data-driven improvements to the program.*

**How to Use:**
1. Navigate to Operations > Program Analytics
2. **Dashboard overview:**
   - Last calculation timestamp
   - Member count analyzed
   - Active vs completed programs
   - Refresh button (recalculates analytics)
3. **Key analytics sections:**

#### A. Compliance Distribution
4. **View compliance tiers:**
   - **High Compliance**: 70-100% (target)
   - **Medium Compliance**: 40-69% (at risk)
   - **Low Compliance**: 0-39% (needs intervention)
   - See percentage of members in each tier
   - Track average compliance by category:
     - Nutrition compliance
     - Supplement adherence
     - Exercise frequency
     - Meditation practice

#### B. Health Outcomes Correlation
5. **MSQ Correlation Analysis:**
   - Scatter plot: Compliance vs MSQ improvement
   - Pearson correlation coefficient (statistical measure)
   - R-squared value (how much compliance explains improvement)
   - P-value (statistical significance)
   - **Interpretation guide:**
     - Correlation > 0.3 = meaningful positive relationship
     - P-value < 0.05 = statistically significant
     - Each point represents one member
6. **PROMIS-29 Correlation:**
   - Same analysis for PROMIS health survey
   - Shows physical/mental function improvements
   - Correlation with compliance score

#### C. At-Risk Member Identification
7. **Quadrant analysis:**
   - **Top Right (Success Stories)**: High compliance + improving health
   - **Top Left (Motivational Support)**: Low compliance but improving (engaged but struggling)
   - **Bottom Right (Clinical Attention)**: High compliance but not improving (need clinical review)
   - **Bottom Left (High Priority)**: Low compliance + worsening health (immediate intervention)
8. **Use quadrant for interventions:**
   - High Priority: Call immediately, assess barriers
   - Clinical Attention: Review health status, adjust program
   - Motivational Support: Provide encouragement, reduce barriers
   - Success Stories: Maintain current approach

#### D. Program Bottlenecks
9. **Curriculum analysis:**
   - Identify modules where members get stuck
   - See average time to complete each module
   - Compare to expected completion time
   - Flag modules with high dropout/delay rates
10. **Missed items patterns:**
    - Which survey questions most frequently skipped
    - Which compliance areas have lowest adherence
    - Timing patterns (day of week, time in program)

#### E. Survey Engagement
11. **Participation metrics:**
    - Average survey completion rate
    - Time between surveys
    - Members ahead vs behind on surveys
    - Survey fatigue indicators

#### F. PROMIS Domain Deep Dive
12. **Domain-specific analysis:**
    - Physical Function: Mobility, daily activities
    - Pain: Intensity and interference
    - Fatigue: Energy levels
    - Sleep: Quality and quantity
    - Emotional: Anxiety and depression
    - Social: Social roles and relationships
13. **Improvement trajectories:**
    - How each domain changes over time
    - Typical improvement curve
    - Identify early vs late responders
14. **Responder rates:**
    - Percentage achieving clinically meaningful improvement
    - Threshold: 5-point T-score change
    - Track by domain and overall

#### G. Cohort Analysis
15. **Compare groups:**
    - New members (Month 1) vs Experienced (Month 3+)
    - Different program types
    - Start date cohorts
16. **Time to first issue:**
    - How quickly members encounter first challenge
    - Average time to first concern reported
    - Predictive indicators

17. **Export and share:**
    - Export any chart to PNG
    - Export data to CSV for custom analysis
    - Schedule automated reports (future feature)

---

## 🔧 ADMIN FEATURES

### 14. Audit Report

**Business Description:**
Comprehensive audit trail viewer for tracking all system changes. Shows who changed what, when, across all database tables. Filterable by table, date range, user, and operation type. Essential for compliance, troubleshooting, and accountability.

**User Story:**
*As a system administrator, I want to view all changes made in the system so that I can ensure accountability, troubleshoot issues, and maintain compliance with audit requirements.*

**How to Use:**
1. Navigate to Admin > Audit Report
2. **Filter audit logs:**
   - **Date Range**: Select start and end date
   - **Table**: Choose specific table (leads, programs, payments, etc.) or "All"
   - **Operation**: INSERT, UPDATE, DELETE, or "All"
   - **User**: Filter by specific user or "All Users"
3. **View audit entries:**
   - Each entry shows:
     - Timestamp (exact date/time)
     - User who made change
     - Table affected
     - Operation type
     - Record ID
     - Summary of change
4. **View change details:**
   - Click any audit entry
   - See complete before/after values:
     - Old Value (before change)
     - New Value (after change)
   - Review all fields changed in single operation
5. **Common use cases:**
   - Track down who changed a price
   - Find when payment was marked as paid
   - Identify who deleted a record
   - Review member program modifications
   - Investigate billing discrepancies
6. **Export audit data:**
   - Click "Export to CSV"
   - Contains full audit trail matching filters
   - Use for compliance reports or detailed investigation

---

### 15. Dashboard Analytics

**Business Description:**
System health monitoring and performance dashboard. Shows dashboard calculation status, member coverage, processing errors, and allows manual recalculation triggers. Helps administrators ensure dashboards are up-to-date and diagnose data issues.

**User Story:**
*As a system administrator, I want to monitor dashboard processing health and trigger recalculations so that I can ensure users see accurate, up-to-date information.*

**How to Use:**
1. Navigate to Admin > Dashboard Analytics
2. **View dashboard status:**
   - Last successful update timestamp
   - Number of dashboards calculated
   - Processing duration
   - Error count and warnings
3. **Trigger recalculation:**
   - Click "Recalculate All Dashboards"
   - System processes in background
   - Takes 1-5 minutes depending on data volume
   - Shows progress indicator
4. **Review errors:**
   - Expand error section
   - See specific dashboard calculation failures
   - Note member IDs with issues
   - Use for troubleshooting data quality
5. **Coverage metrics:**
   - Total active members
   - Members with dashboard data
   - Coverage percentage (target: 100%)
   - Identify members missing dashboards

---

### 16. Payments

**Business Description:**
System-wide payment search and management tool. Allows searching payments across all programs, filtering by status and date range, viewing payment details, and generating payment reports. Useful for accounting, reconciliation, and following up on late payments.

**User Story:**
*As an accountant, I want to search and view all payments across the organization so that I can reconcile accounts, track receivables, and identify late payments.*

**How to Use:**
1. Navigate to Admin > Payments
2. **Search payments:**
   - Enter member name in search box
   - Select payment status filter:
     - All Payments
     - Pending (due but not paid)
     - Paid (received)
     - Late (overdue)
     - Cancelled
   - Select date range
3. **View payment list:**
   - See all matching payments
   - **Columns:**
     - Member Name
     - Program Name
     - Payment Amount
     - Due Date
     - Payment Date (when actually paid)
     - Status
     - Payment Method
     - Reference Number
4. **Payment details:**
   - Click any payment row
   - View complete information:
     - Full payment history
     - Original schedule
     - Notes and adjustments
5. **Generate reports:**
   - Filter as needed
   - Click "Export to CSV"
   - Use for:
     - Monthly payment received report
     - Outstanding receivables (Pending + Late)
     - Cash flow analysis
     - Member payment history

---

### 17. Program Audit

**Business Description:**
Specialized audit view for program-level changes, showing modifications to program structure, items, financials, and payments. Filterable by member and date range. Provides clean interface for reviewing program modifications without system-level noise.

**User Story:**
*As a program manager, I want to review all changes made to member programs so that I can ensure accuracy and resolve any discrepancies.*

**How to Use:**
1. Navigate to Admin > Program Audit
2. **Filter program changes:**
   - Select specific member (or "All Members")
   - Choose date range
   - Select program if member has multiple
3. **View change categories:**
   - **Program Info**: Status, name, dates
   - **Items**: Added, removed, or modified therapies/supplements
   - **Financials**: Pricing, taxes, finance charges, discounts
   - **Payments**: Payment schedule changes, status updates
   - **Script/Tasks**: Completion status, date changes
4. **Review change details:**
   - See before/after values
   - Timestamp of each change
   - User who made change
5. **Common audit scenarios:**
   - Member disputes charge: Review pricing history
   - Payment marked paid incorrectly: Find when changed
   - Items removed by mistake: Identify who/when
   - Price changed without authorization: Audit trail

---

### 18. Program Templates

**Business Description:**
Template library for creating standardized programs. Templates include predefined items (therapies, supplements, appointments), task checklists, RASHA sequences, and pricing. Enables rapid program creation with consistent content while allowing customization per member.

**User Story:**
*As a program designer, I want to create and maintain program templates so that staff can quickly build customized programs without starting from scratch every time.*

**How to Use:**
1. Navigate to Admin > Program Templates
2. **Create new template:**
   - Click "Create New Template"
   - Enter template name (e.g., "Level 1 - Detox")
   - Add description
   - Start with empty template
3. **Add items to template:**
   - Click "Add Item"
   - Select therapy/supplement/appointment
   - Set default quantity
   - Set timing:
     - **days_from_start**: Days after program start (0 = day 1)
     - **days_between**: Interval for repeating items (0 = one-time)
   - Example: "IV Therapy, quantity 4, days_from_start 0, days_between 7"
     = Four IV treatments starting day 1, every 7 days
   - Add instructions (shown to coordinator during delivery)
4. **Add tasks to template:**
   - Switch to "Tasks" tab
   - Tasks are linked to specific items
   - Click "Add Task" on any item
   - Enter task name (e.g., "Call member to confirm appointment")
   - Set task_delay: Days before/after item scheduled date
     - Negative = before (e.g., -2 = 2 days before)
     - Positive = after (e.g., +1 = day after)
   - Assign responsible role (Coordinator, Admin, Provider)
5. **Add RASHA sequence (if applicable):**
   - Switch to "RASHA" tab
   - Add RASHA frequency list items
   - Set order/sequence
   - Specify if individual or group session
6. **Set template pricing:**
   - System auto-calculates from items
   - View total cost (what it costs you)
   - View total charge (what member pays)
   - View margin percentage
7. **Edit existing template:**
   - Templates can be modified anytime
   - Changes don't affect existing programs (already copied)
   - Only affects new programs created from template
8. **Use template to create program:**
   - Go to Sales > Programs > Create New Program
   - Select this template
   - System copies all items, tasks, RASHA sequence
   - Now customizable per member

---

### 19. Therapies

**Business Description:**
Product and service catalog containing all therapies, supplements, supplies, appointments, and services. Defines cost (what you pay), charge (what member pays), bucket (inventory status), type, and default scheduling role. Core master data used across programs, templates, and inventory.

**User Story:**
*As an administrator, I want to maintain the master list of all products and services so that staff can build accurate programs with current pricing.*

**How to Use:**
1. Navigate to Admin > Therapies
2. **View all therapies:**
   - See complete catalog
   - Search by name
   - Filter by type or bucket
3. **Add new therapy:**
   - Click "Add New Therapy"
   - Enter therapy name (e.g., "Vitamin D3 5000 IU")
   - Select therapy type:
     - **Therapy**: IV treatments, procedures, services
     - **Supplement**: Vitamins, minerals, herbs
     - **Appointment**: Consultation, follow-up visit
     - **Supply**: Equipment, materials
     - **Lab**: Laboratory tests
     - **Other**: Miscellaneous
   - Select bucket:
     - **Inventory**: Physical products tracked in inventory
     - **Service**: Services not tracked in inventory
   - Enter cost (what it costs you to provide)
   - Enter charge (what you charge member)
   - Check "Taxable" if subject to sales tax
   - Select program role (who's responsible):
     - Coordinator (default for most items)
     - Provider (for clinical items)
     - Admin (for administrative items)
     - Member (for member self-service)
   - Add description (optional)
   - Click "Save"
4. **Edit therapy:**
   - Click "Edit" icon on any therapy
   - Update cost when vendor prices change
   - Update charge when adjusting pricing
   - **Important**: Changes don't affect existing programs (prices locked)
   - Only affects new programs and templates
5. **Add tasks to therapy:**
   - Click therapy name to open details
   - Go to "Tasks" tab
   - Click "Add Task"
   - Example: "IV Therapy" might have tasks:
     - "Order IV supplies" (-2 days before)
     - "Confirm member arrival time" (-1 day before)
     - "Follow-up call" (+1 day after)
   - Tasks auto-copy to programs when therapy added
6. **Deactivate therapy:**
   - Click "Delete" (actually deactivates, not deleted)
   - Hidden from selection lists
   - Still appears in existing programs
   - Can reactivate later if needed

---

### 20. Therapy Tasks

**Business Description:**
Master task template library linked to therapies. Defines coordinator/provider tasks that should occur relative to therapy delivery. Tasks automatically copy to programs when therapy added, with calculated due dates based on scheduled therapy date and task delay.

**User Story:**
*As an operations manager, I want to define standard tasks for each therapy so that coordinators automatically receive reminders without manual task creation.*

**How to Use:**
1. Navigate to Admin > Therapy Tasks
2. **View all therapy tasks:**
   - See tasks organized by therapy
   - Search by task name or therapy
3. **Add task to therapy:**
   - Click "Add New Task"
   - Select therapy this task applies to
   - Enter task name (action to perform)
   - Add description (detailed instructions)
   - Set task delay in days:
     - **Negative**: Before therapy (e.g., -2 = 2 days before)
     - **Positive**: After therapy (e.g., +1 = next day)
     - **Zero**: Same day as therapy
   - Select responsible role:
     - Coordinator (most common)
     - Provider (clinical tasks)
     - Admin (administrative)
   - Click "Save"
4. **Example task setup:**
   - Therapy: "IV Glutathione Therapy"
   - Tasks:
     - "Order IV supplies" (task_delay: -3 days, role: Coordinator)
     - "Prepare IV bag" (task_delay: 0 days, role: Provider)
     - "Follow-up call" (task_delay: +1 day, role: Coordinator)
5. **How tasks work in programs:**
   - Member program created with IV therapy scheduled for June 15
   - System auto-creates tasks:
     - "Order IV supplies" due June 12 (-3 days)
     - "Prepare IV bag" due June 15 (0 days)
     - "Follow-up call" due June 16 (+1 day)
   - Tasks appear in Coordinator > To Do tab
   - Coordinator checks off as completed
6. **Edit task:**
   - Changes affect only new programs
   - Existing programs keep old task definitions
7. **Best practices:**
   - Keep task names action-oriented ("Call member" not "Member call")
   - Use negative delays for preparation tasks
   - Use positive delays for follow-up tasks
   - Assign appropriate role for accountability

---

### 21. User Management

**Business Description:**
User account management for controlling system access and permissions. Create users, assign admin privileges, grant menu-specific permissions, activate/deactivate accounts. Supports role-based access control ensuring users see only what they need.

**User Story:**
*As a system administrator, I want to manage user accounts and permissions so that I can control who has access to sensitive areas of the system.*

**How to Use:**
1. Navigate to Admin > User Management
2. **View all users:**
   - See complete user list
   - Active status indicator
   - Admin flag
   - Permission count
3. **Create new user:**
   - Click "Add New User"
   - User must first sign up through login page
   - Then you'll see them in user list
   - Set initial status to "Inactive" until ready
4. **Manage permissions:**
   - Click "Edit" on user
   - **Admin users**:
     - Check "Is Admin" box
     - Automatically gets access to everything
     - No menu restrictions
   - **Regular users**:
     - Uncheck "Is Admin"
     - Select specific menu items to grant access
     - User sees only checked items in sidebar
5. **Grant menu access:**
   - Select from all available menu paths:
     - Dashboard
     - Coordinator
     - Order Items
     - Report Card
     - Campaigns
     - Leads
     - Programs
     - Inventory features
     - Admin features (be selective)
6. **Activate/deactivate user:**
   - Toggle "Is Active" status
   - Inactive users cannot log in
   - Doesn't delete user or their history
   - Can reactivate anytime
7. **Reset user password:**
   - User must use "Forgot Password" on login page
   - System sends reset email
   - Admin cannot see passwords
8. **Permission strategy:**
   - **Coordinators**: Dashboard, Coordinator, Order Items, Report Card
   - **Sales**: Dashboard, Leads, Programs, Sales Reports
   - **Operations**: Dashboard, all Operations features
   - **Admins**: Everything (check "Is Admin")

---

## 📚 LOOKUP TABLES (ADMIN > LOOKUP)

### 22. Bodies

**Business Description:**
Body system categorization for therapies (Digestive, Immune, Neurological, etc.). Used for filtering and organizing therapies by which body system they support.

**How to Use:**
- Navigate to Admin > Lookup > Bodies
- Add/edit/deactivate body system categories
- Link therapies to bodies in Therapies screen

---

### 23. Buckets

**Business Description:**
Inventory classification for therapies. Determines if item is tracked in inventory system or is a service.

**Values:**
- **Inventory**: Physical products (supplements, supplies)
- **Service**: Non-physical services (consultations, procedures)

**How to Use:**
- Navigate to Admin > Lookup > Buckets
- Generally only two buckets needed
- Assign to therapies in Therapies screen

---

### 24. Financing Types

**Business Description:**
Payment arrangement options for programs. Defines how member will pay (upfront, payment plan, insurance, etc.).

**How to Use:**
- Navigate to Admin > Lookup > Financing Types
- Add financing options:
  - Full Payment (cash upfront)
  - Payment Plan (installments)
  - Insurance Billing
  - HSA/FSA
  - Financing (third-party loan)
- Mark as Internal (you manage) or External (third-party manages)
- Assign to programs in Financials tab

---

### 25. Lead Status

**Business Description:**
Sales pipeline stages for lead tracking. Defines progression from initial contact through sale.

**Standard Statuses:**
- New Lead
- PME Scheduled
- Sold
- Not Interested
- Lost to Competition
- Invalid Lead

**How to Use:**
- Navigate to Admin > Lookup > Lead Status
- Add/edit statuses to match your sales process
- Assign to leads in Leads screen

---

### 26. Payment Methods

**Business Description:**
Payment type tracking for financial reporting. How member paid (cash, check, credit card, etc.).

**Standard Methods:**
- Cash
- Check
- Credit Card
- ACH/Bank Transfer
- PayPal/Venmo
- Other

**How to Use:**
- Navigate to Admin > Lookup > Pay Methods
- Add payment methods you accept
- Assign when marking payments as paid

---

### 27. Payment Status

**Business Description:**
Payment lifecycle stages for payment tracking.

**Standard Statuses:**
- Pending: Due but not paid
- Paid: Received
- Late: Overdue
- Cancelled: Payment voided

**How to Use:**
- Navigate to Admin > Lookup > Pay Status
- Standard statuses usually sufficient
- System auto-manages status transitions

---

### 28. Pillars

**Business Description:**
Health pillar categorization (Nutrition, Exercise, Sleep, Stress, etc.). Used for organizing therapies by wellness category.

**How to Use:**
- Navigate to Admin > Lookup > Pillars
- Add health pillars matching your program philosophy
- Link therapies to pillars in Therapies screen

---

### 29. Program Roles

**Business Description:**
Responsibility assignment for program items and tasks. Defines who's accountable for delivering/completing each element.

**Standard Roles:**
- Coordinator: Day-to-day program management
- Provider: Clinical services
- Admin: Administrative tasks
- Member: Self-service items

**How to Use:**
- Navigate to Admin > Lookup > Program Roles
- Add roles matching your org structure
- Assign in Therapies (default role per therapy)
- System uses for filtering Coordinator views

---

### 30. Program Status

**Business Description:**
Program lifecycle stages defining member journey.

**Standard Statuses:**
- Quote: Proposal stage
- Active: Currently enrolled
- Paused: Temporary hold
- Completed: Successfully finished
- Cancelled: Terminated early
- Lost: Deal didn't close

**How to Use:**
- Navigate to Admin > Lookup > Program Status
- Standard statuses usually sufficient
- Define in Programs screen
- Status rules enforced by system (can't go from Completed to Active)

---

### 31. RASHA List

**Business Description:**
RASHA frequency sequence library for frequency-based therapy protocols. Each entry represents a specific frequency setting with duration.

**How to Use:**
- Navigate to Admin > Lookup > RASHA
- Add RASHA frequencies:
  - Name (e.g., "Detox Frequency 1")
  - Length (duration in minutes)
- Assign sequences to program templates
- System copies to member programs

---

### 32. Therapy Types

**Business Description:**
Therapy categorization for organization and reporting.

**Standard Types:**
- Therapy: Medical procedures, IV treatments
- Supplement: Vitamins, minerals, herbs
- Appointment: Consultations, visits
- Supply: Equipment, materials
- Lab: Laboratory tests
- Other: Miscellaneous

**How to Use:**
- Navigate to Admin > Lookup > Therapy Types
- Add types matching your service offerings
- Assign to therapies in Therapies screen
- Use for filtering and reporting

---

### 33. Vendors

**Business Description:**
Vendor/partner directory for campaign tracking and purchasing.

**How to Use:**
- Navigate to Admin > Lookup > Vendors
- Add vendors:
  - Vendor name
  - Contact person
  - Phone
  - Email
- Link campaigns to vendors (marketing partnerships)
- Use for purchase order management

---

## 🎯 QUICK REFERENCE

### Common Workflows

**New Member Enrollment:**
1. Add lead (Marketing > Leads)
2. Update status to "PME Scheduled" with date
3. After PME, create program (Sales > Programs)
4. Customize items and pricing
5. Set up payment schedule
6. Change status to "Active" when first payment received
7. Member appears in Dashboard and Coordinator

**Weekly Coordinator Routine:**
1. Check Coordinator > Dashboard metrics
2. Review "Late Tasks" (follow up on overdue items)
3. Complete "Tasks Due Today"
4. Review "Appointments Due Today"
5. Check "Program Changes" for recent modifications
6. Review Member Progress tab for red/yellow status members

**Monthly Inventory Management:**
1. Review Inventory Forecast for upcoming month
2. Create POs for items with "Need to Order" > 0
3. Submit POs for approval
4. Place orders with vendors
5. Receive items as delivered
6. Perform cycle count (10-20% of items monthly)

**Quarterly Analytics Review:**
1. Run Program Analytics > Compliance Distribution
2. Review MSQ/PROMIS correlations
3. Identify at-risk members (quadrant analysis)
4. Review curriculum bottlenecks
5. Share insights with clinical team
6. Implement program improvements

---

## 📞 SUPPORT

For technical support or feature requests:
1. Contact your system administrator
2. Check audit logs for data discrepancies
3. Review this guide for usage questions
4. Submit feedback for feature enhancements

---

*Last Updated: November 2025*
*Version: 1.0*





