# SplitWise — Complete Technical & Functional Documentation

A comprehensive, production-grade expense sharing, group debt settlement, and real-time financial tracking platform designed for flatmates, travel groups, households, and shared living communities.

---

## 1. Executive System Overview & Design Philosophy

SplitWise solves the everyday friction of shared expenses, bill tracking, and peer-to-peer debt settlements. In traditional shared living environments, roommates and group members struggle with messy notes, delayed settlements, awkward payment reminders, floating-point rounding errors, and lack of transparency.

SplitWise provides a unified, real-time financial ledger that gives every group member total clarity over who paid, who benefited, how much is owed, and how to settle debts instantly with integrated UPI deep links, QR codes, push notifications, and AI-driven spending analytics.

### Core Architectural Principles
* **Integer-Paise Precision**: All monetary values are accumulated and calculated internally in integer paise (\(\text{rupees} \times 100\)). Rounding to rupees happens only at presentation boundaries, guaranteeing zero floating-point penny drift.
* **Separation of Attribution vs. Obligation**: The platform strictly decouples *Historical Spending Attribution* (who benefited from which expenses over a selected calendar window) from *Live Outstanding Obligations* (who currently owes whom in real life). Date filters analyze past behavior without distorting unsettled debts.
* **Non-Netted Pairwise Preserved Debts**: Direct pairwise balances are preserved so that Member A settling with Member B does not invisibly alter Member C's balance without consent, ensuring transparent member-to-member trust.
* **Multi-Platform Real-Time Sync**: Changes made by any member reflect across all active browsers and mobile applications instantly via WebSockets, supported by cross-platform Web Push and native push notifications.

---

## 2. Executive Dashboard & Financial UI

The dashboard serves as the central command center for the active group. Every number, chart, and alert updates dynamically based on the active member and the applied filters.

### 2.1 Dynamic Financial Summary Cards
Positioned at the top of the dashboard, these cards provide immediate financial health indicators:
* **Total Group Spending**: The gross monetary sum of all valid expenses recorded within the active filter range.
* **Total Paid by User**: The total amount funded out-of-pocket by the logged-in member.
* **User's Benefited Share**: The actual cost burden assigned to the logged-in member across all split records.
* **Net Balance Position**: A color-coded financial indicator:
  * **Positive (Green - You are Owed)**: Displays the net receivable amount across all flatmates with a breakdown of who owes you.
  * **Negative (Red - You Owe)**: Displays the net payable amount with an itemized breakdown of whom you need to pay.
  * **Zero (Slate - Settled Up)**: Clear visual badge confirming that all accounts are balanced.

### 2.2 Contextual Attention Center
An intelligent, proactive alert feed that highlights immediate actionable items for the logged-in member:
* **Pending Settlement Approvals**: Highlights payments made to you by other flatmates awaiting your verification and receipt review.
* **High-Priority Debts**: Suggests upcoming payments or debts exceeding predefined thresholds.
* **Outstanding Payment Promises**: Reminds users of "Will Pay Soon" commitments made to flatmates.
* **Clean State Banner**: Reassuring confirmation when no pending actions or unsettled debts remain.

### 2.3 Person-Wise Financial Relationships
A dedicated relationship module that breaks down financial ties with every flatmate:
* Displays directional spending: **"I Paid For Them"** vs. **"They Paid For Me"**.
* Displays live obligations: **"I Currently Owe"** vs. **"They Currently Owe"**.
* Quick-action **"Settle"** button: Opens a pre-configured settlement modal with the exact amount and the flatmate's personal payment details pre-loaded.
* Tap-to-expand details: Displays the count of shared expenses, last transaction date, and detailed breakdown.

### 2.4 Financial Relationship Matrix (Full Grid View)
For group administrators and members who want total group visibility, the Relationship Table renders an \(N \times N\) matrix showing directional balances between every pair of group members, ensuring complete auditability.

### 2.5 Real-Time Activity Feed & Recent Expenses
* Chronological timeline of all group transactions, edits, settlements, and member changes.
* Each entry displays the category badge, payer avatar, timestamp, total amount, the user's specific share, payment method badge (Cash / UPI), and receipt thumbnail.
* Click-to-inspect opens the comprehensive Expense Detail modal with itemized split tables and receipt viewer.

### 2.6 Spending Analytics & Interactive Visualizations
* **Category Breakdown**: Visual distribution of expenses across categories (Groceries, Food & Dining, Rent, Utilities, Entertainment, Travel, Household, Medical, and Other).
* **Expenses Over Time**: Daily, weekly, or monthly aggregations showing group spending trajectories and spike dates.
* **Top Spenders & Top Beneficiaries**: Identifies who funds group activities most frequently and who incurs the highest personal shares.

### 2.7 Multi-Dimensional Report Filter Engine
A persistent filter bar that lets members slice and dice group finances without altering the underlying live balance:
* **Date Range Presets**: *All Time*, *Today*, *This Week*, *This Month*, *Last Month*, and *Custom Date Range*.
* **Timezone-Aligned Bounds**: Date bounds resolve directly to the client's local day boundaries (e.g. local midnight to local 23:59:59), eliminating UTC off-by-one errors.
* **Member Filter**: Focus on expenses involving a specific flatmate.
* **Payment Mode Filter**: Filter by *Cash*, *UPI / Online*, or *All*.
* **Involvement Filter**: Filter by *All Group Expenses*, *Involving Me*, *Paid by Me*, or *Paid by Others for Me*.

---

## 3. Expense Management & Advanced Splitting Engine

The expense management engine handles the recording, computation, modification, and auditing of group spending.

### 3.1 Integer-Paise Mathematical Splitting
When an expense is split among members, division can produce fractional cents/paise. SplitWise uses a remainder distribution algorithm to ensure the sum of shares equals the total amount down to the single paisa:
1. Convert total amount to integer paise: \(\text{paise} = \text{round}(\text{amount} \times 100)\).
2. Calculate the base share per participant: \(\text{base} = \lfloor \text{paise} / N \rfloor\).
3. Compute the remainder: \(\text{remainder} = \text{paise} \pmod N\).
4. Distribute the remainder paisa-by-paisa to the first \(K\) participants.
5. Convert back to standard currency format: \(\text{share}_i = (\text{base} + (i < \text{remainder} ? 1 : 0)) / 100\).
*Result: Zero rounding leaks. \(\sum \text{shares} \equiv \text{amount}\).*

### 3.2 Split Mechanisms
* **Split with Everyone**: Automatically includes all active group members with equal distribution.
* **Specific Members**: Allows the payer to select any custom subset of flatmates (e.g., only flatmates who attended a specific dinner or share an air conditioner).
* **Multi-Payer Scenarios**: Supports logging expenses funded on behalf of others while tracking individual contributions.

### 3.3 Receipt Capture & Cloud Image Storage
* Full integration with Cloudinary cloud storage for bill and receipt uploads.
* Built-in client-side compression before upload to conserve mobile bandwidth.
* Secure image viewing with modal zoom, rotation, and external full-resolution preview.
* Safe asset cleanup: When an expense with a receipt is deleted or replaced, its remote Cloudinary asset is automatically destroyed via API to eliminate orphan storage.

### 3.4 In-App QR Scanner & Receipt Editor
* Integrated camera-based QR code scanner for rapid bill detection and payment scanning.
* Built-in receipt editor allowing users to crop, rotate, and highlight invoice items before attaching them to transactions.

### 3.5 Validation, Auditing & Life-Cycle Safeguards
* **Future-Date Prevention**: Expenses cannot be backdated to future dates (with an automatic 24-hour buffer to support international timezones).
* **Non-Member Guard**: Payers and beneficiaries must strictly belong to the group at the time of expense creation.
* **Audit Trail**: Any edit to an expense's amount, participants, or category logs an activity record and triggers real-time socket recalculations.
* **Safe Deletion**: Deleting an expense reverses all associated debt graph edges and prompts an automatic recalculation of balances across all affected members.

---

## 4. Settlement & Peer-to-Peer Payment Workflow

Settlements in SplitWise reflect real-world payments between members, providing complete proof and mutual verification.

### 4.1 Debt Simplification & Pairwise Balance Engine
Unlike naive netting algorithms that reroute debts through unrelated third parties (creating confusion over who owes whom), SplitWise maintains direct pairwise integrity:
* Calculates the exact net debt vector between User A and User B.
* If A owes B ₹500 and B owes A ₹200, the system displays a direct net requirement of A paying ₹300 to B.
* Allows partial settlements, exact balance settlements, or custom amounts.

### 4.2 Integrated Indian UPI Ecosystem
* **Standard UPI Deep Linking**: Generates native `upi://pay` URI intents formatted with:
  * Payee VPA (`pa`)
  * Payee Name (`pn`)
  * Transaction Amount (`am`)
  * Currency Code (`cu=INR`)
  * Transaction Reference Note (`tn`)
* Tapping **"Pay with UPI"** on a mobile device automatically triggers the user's installed UPI apps (Google Pay, PhonePe, Paytm, BHIM, CRED).
* **Dynamic UPI QR Code Generation**: For desktop users, the system renders a high-definition dynamic QR code that can be scanned with any smartphone camera.
* **Custom Personal QR & UPI ID**: Each member can upload their personal UPI ID and static payment QR code in their Profile settings. These are automatically presented to debtors when initiating settlements.

### 4.3 Two-Party Verification Workflow
To prevent fraudulent or mistaken balance deductions, settlements follow a verification cycle:
1. **Initiation**: The debtor selects the creditor, enters the amount, chooses the method (UPI or Cash), and uploads a proof screenshot (mandatory for online UPI).
2. **Pending State (`paid_pending_approval`)**: The settlement is recorded, an activity log is generated, and a push notification is dispatched to the creditor. The debt is **not** deducted from the live balance yet.
3. **Verification**:
   * **Approved (`completed`)**: The creditor inspects the payment proof and clicks **"Verify & Accept"**. The debt graph is immediately updated, reducing the balance in real time.
   * **Rejected (`rejected`)**: If payment was not received or the proof was invalid, the creditor clicks **"Reject"** with an optional rejection reason. The debt remains active.
4. **Soft Commitments (`will_pay_soon`)**: Debtors can signal upcoming payments without submitting proof. This notifies the creditor and marks the relationship with an active promise indicator.

### 4.4 Settlement History & Proof Drawer
* Dedicated settlement slide-over drawer showing historical payments.
* Filterable by status: *All*, *Completed*, *Pending*, *Rejected*.
* Displays full payment metadata: payer, receiver, amount, payment method, payment timestamp, verification timestamp, notes, rejection reasons, and clickable payment proof thumbnails.

---

## 5. Group Lifecycle & Multi-Tenancy Architecture

SplitWise supports multiple groups with workspace isolation, member onboarding, and administrative governance.

### 5.1 Multi-Group Management
* Users can belong to multiple groups simultaneously (e.g., "Apartment 402", "Goa Trip 2026", "Office Lunch Club").
* The active group can be switched with one tap from the navigation bar.
* All dashboard data, socket channels, and push alerts scope exclusively to the active group context.

### 5.2 Seamless Group Onboarding & Dynamic Group QR Codes
* **Shareable Join Links**: Group admins can generate unique invite tokens (`/join/:token`).
* **Group QR Code**: The system generates a dedicated Group Invitation QR code that flatmates can scan directly from their mobile camera to join the group instantly.
* **Pending Token Catching**: If an unauthenticated user opens an invite link, the token is preserved in session storage across the login/signup flow and automatically joined upon successful authentication.

### 5.3 Role-Based Access Control (RBAC)
* **Group Creator / Admin**:
  * Edit group metadata (name, description, default currency).
  * Manage member roles.
  * Remove members (subject to zero-debt validation).
  * Archive or delete group.
* **Member**:
  * Add, edit, and view expenses.
  * Initiate and verify settlements.
  * Export reports and interact with AI features.
* **Inspector**:
  * Read-only administrative access for forensic balance verification and audit checks.
* **Super-Admin**:
  * Platform-wide telemetry, group governance, user management, and system health monitoring.

### 5.4 Safe Exit & Member Deletion Protections
* A member **cannot** be removed or leave a group if they have unsettled debts (\(\text{amount owed} > 0\) or \(\text{amount receivable} > 0\)).
* The system enforces a mandatory settlement prerequisite to prevent groups from having dangling debt references.

---

## 6. Notification & Real-Time Sync Infrastructure

The application keeps all flatmates synchronized through a 4-tier communication stack.

### 6.1 In-App Notification Center
* Notification bell with real-time unread badge counter.
* Categorized alerts: New Expenses, Expense Edits, Settlement Requests, Payment Verifications, Member Joins.
* Actions: Mark single notification as read, mark all as read, clear notification feed.
* Direct navigation: Clicking a notification routes the user directly to the relevant expense or settlement record.

### 6.2 Real-Time WebSocket Engine (Socket.IO)
A persistent WebSocket connection delivers instant updates across all active clients:
* **Event Channels**:
  * `expense_created` / `expense_updated` / `expense_deleted`: Updates the expense feed and recalculates dashboard cards without page reloads.
  * `settlement_created`: Alerts the receiver with an instant notification toast and updates the Attention Center.
  * `settlement_verified`: Re-runs balance calculations on all connected flatmate devices simultaneously.
  * `balance_update`: Pushes updated pairwise debt graphs to all group sockets.
* **Connection Resilience**: Automatic heartbeat, reconnection backoff, and state re-synchronization upon network recovery.

### 6.3 Cross-Platform Web Push Notifications (VAPID)
* Standards-compliant Web Push utilizing the browser's native Push API and Service Workers.
* Auto-generated VAPID keypairs (`web-push`) with contact email configuration.
* Browser subscription lifecycle stored in MongoDB (`PushSubscription` model).
* Automatic self-cleaning: Subscriptions that return `410 Gone` or `404 Not Found` are automatically pruned from the database.
* Background delivery: Delivers notifications even when the browser tab is closed or minimized.

### 6.4 Native Push Notifications (Firebase Cloud Messaging - FCM)
* Integration with Capacitor Push Notifications for native Android and iOS mobile app packages.
* FCM device tokens registered alongside Web Push subscriptions.
* Unified dispatch helper: `sendPushToUser` automatically routes notifications across both Web Push endpoints and native FCM tokens.

---

## 7. Audit-Grade Multi-Sheet Financial Excel Export Engine

The reporting service builds professional, multi-tab `.xlsx` workbooks using `exceljs`. Every figure matches the dashboard analytics with zero discrepancies.

### 7.1 Multi-Sheet Workbook Architecture
The generated workbook includes 6 specialized worksheets:

1. **`Summary`**:
   * Header branding and metadata (User, Email, Group Name, Role, Export Timestamp).
   * Applied filter parameters (Date Range, Person, Payment Mode, Involvement).
   * Selected Period Spending summary (Expense count, total spend, user funded, user share, average expense, largest single expense).
   * Lifetime Outstanding Position (Live debts owed, debts receivable, net position).
2. **`Expenses`**:
   * Comprehensive chronological expense ledger.
   * Columns: Expense ID, Date, Title, Total Amount, Paid By, Payment Mode, Split Type, Participant Count, User's Share, User's Involvement, Notes, Receipt Flag.
3. **`Expense Splits`**:
   * Relational long-format data sheet designed for spreadsheet pivot tables.
   * Maps each expense to every individual participant with their specific monetary contribution and payer flag.
4. **`Person-wise Relationship`**:
   * Detailed breakdown for every flatmate.
   * Columns: Person Name, I Paid For Them, They Paid For Me, I Currently Owe, They Currently Owe, Net Relationship, Shared Expense Count, Last Expense Date.
5. **`Settlements`**:
   * Complete payment history registry.
   * Columns: Settlement ID, Created Date, Payer, Receiver, Amount, Payment Method, Status, Paid Timestamp, Verified Timestamp, Balance Impact Flag, Notes, Rejection Reasons.
6. **`Period Breakdown`**:
   * Time-series aggregations grouped by Day, Week, or Month.
   * Columns: Period Label, Expense Count, Total Expense, Paid by User, User's Share, Paid for Others, Paid by Others for User.
   * Automated reconciliation total row matching the master Summary sheet.

### 7.2 Security & Formatting Standards
* **Formula Injection Prevention**: Text values beginning with `=`, `+`, `-`, or `@` are automatically prefixed with an apostrophe (`'`) to prevent malicious formula execution in spreadsheet software.
* **Styling**: Distinct brand header rows, frozen top panes for scrolling readability, alternating row shading, native date formats (`dd mmm yyyy`), and currency number formatting (`₹#,##0.00`).
* **Auto-Filters**: All tables feature enabled Excel auto-filter dropdowns across all columns.

---

## 8. AI Financial Assistant & Semantic Vector Search (RAG Engine)

SplitWise includes an integrated AI Assistant powered by Google Gemini and vector embeddings.

### 8.1 Conversational Drawer UI
* Floating action button with an expandable, touch-friendly slide-out chat interface.
* Real-time streaming response generation with token animation.
* Visual Tool Status indicators: Displays when the AI is reading group balances, querying date ranges, or performing vector searches.
* One-tap suggestion pills for common questions (*"Who owes me money?"*, *"How much did we spend on food this month?"*, *"Summarize our group debts"*).

### 8.2 Function-Calling Orchestrator & Tool Suite
The AI orchestrator uses deterministic function calling to fetch live database records before answering user questions:
* `get_current_balances`: Reads the user's live debt/credit standing and list of debtors/creditors.
* `get_balance_with_person`: Inspects exact directional dues with a named flatmate.
* `get_user_expense_summary`: Calculates spending totals, personal shares, and category distributions over natural timeframes (*"August"*, *"last week"*, *"yesterday"*).
* `get_expenses_by_date_range`: Retrieves chronological transactions matching temporal queries.
* `get_expenses_by_person`: Finds expenses funded by or benefiting a specific person.
* `get_settlement_history`: Queries completed or pending settlement records.
* `get_group_members`: Retrieves the authoritative list of current group members.
* `get_group_financial_summary`: Computes group-wide spending metrics and top contributor rankings.

### 8.3 Semantic Vector Search (Pinecone RAG)
* Group expenses are vectorized into high-dimensional embeddings upon creation.
* The `semantic_expense_search` tool queries Pinecone to find expenses based on natural language concepts and memories (e.g., *"weekend pizza party"*, *"that grocery trip after the movies"*, *"wifi bill"*), even if the exact keyword was not in the title.

### 8.4 Multi-Lingual & Hinglish Understanding
The date resolver and prompt engineering layer understand colloquial Indian phrasing and mixed-language expressions (e.g., *"Pichhle mahine ka hisab batao"*, *"Rahul ko kitna paisa dena hai"*, *"Kharcha summary dikhao"*).

### 8.5 Watchdogs & Execution Limits
* 15-second execution watchdog with `AbortController` integration to terminate hung AI streams and conserve API resources.
* Guard against infinite tool loops capped at a maximum of 4 function calling iterations per turn.

---

## 9. Administrative, Super-Admin & Inspector Consoles

For platform managers and group auditors, SplitWise provides dedicated management consoles.

### 9.1 Super-Admin Dashboard (`/admin`)
* **Global Platform Telemetry**: Total registered users, total active groups, aggregate monetary transactions processed, system uptime.
* **User Governance**: Searchable directory of all users with role management, status toggles, and group affiliation metrics.
* **Group Governance**: Directory of all groups across the platform with member counts, expense volumes, and administrative controls.
* **System Health Indicators**: Real-time database connection status, WebSocket connection counts, push notification health.

### 9.2 Inspector Dashboard (`/inspector`)
* Specialized read-only portal for detailed forensic inspection of transactions.
* Verifies ledger parity and mathematical integrity across groups without altering live balances or disturbing user sessions.

---

## 10. Security, Privacy & Mobile-First UX Architecture

SplitWise is engineered to deliver a secure, high-performance experience across mobile, tablet, and desktop devices.

### 10.1 Authentication & Data Security
* **Stateless JWT Authentication**: Secure bearer tokens with configurable expiration.
* **Password Encryption**: Cryptographically salted password hashing using bcrypt.
* **Password Strength Meter**: Dynamic client-side password entropy evaluation (Length, Character diversity, Special symbol tests).
* **Sanitized Queries & Rate Limiting**: Input sanitization across API endpoints and rate-limiting middleware to guard against brute-force attacks.
* **Strict Schema Validation**: Mongoose models enforce validation rules, required fields, and type constraints.

### 10.2 Responsive Mobile-First Architecture
* **Dual-Panel Desktop Experience ( \(\ge 1024\text{px}\) )**:
  * Rich dark-navy brand showcase on the left highlighting key value propositions and security badges.
  * Spacious form controls on the right.
* **Native Mobile Experience ( \(< 1024\text{px}\) )**:
  * Dark showcase panel is strictly suppressed (`display: none !important`) to eliminate horizontal scrolling.
  * Edge-to-edge card layout (`max-width: 460px`) with compact 20px padding (`px-5 py-6`), maximizing input area.
  * Top brand bar with app logo and security trust badge (`Secure Login` / `Free Account`).
  * Quick-switch segmented tab control (`[ Sign In ]   [ Sign Up ]`) for one-tap switching between auth views.
* **Touch-Friendly 48px Input Geometry**: All inputs and primary buttons feature a minimum 48px touch height with 12px rounded corners, conforming to mobile ergonomics.
* **Zero iOS Auto-Zoom Snap**: Input font sizes are standardized to 16px, preventing iOS Safari and Capacitor WebViews from automatically zooming the viewport on focus.
* **Mobile Keyboards**: Inputs include explicit `inputMode="email"`, `inputMode="tel"`, and autocomplete flags.
* **Safe-Area Insets**: Incorporates `calc(env(safe-area-inset-bottom, 16px) + 16px)` to prevent interface overlap with iOS home indicator bars and Android gesture navigation bars.
* **Fixed Desktop Sidebar vs. Mobile Bottom Navigation**: Desktop layouts feature an ergonomic fixed sidebar; mobile devices present an intuitive 4-tab bottom navigation bar.

---

## 11. System Data Models & Database Relationships

```
+-------------------------------------------------------------------------+
|                                 USER                                    |
| _id, fullName, email, phone, password, upiId, qrCodeUrl, isSuperAdmin   |
+-------------------------------------------------------------------------+
       | 1                                                 | 1
       |                                                   |
       v *                                                 v *
+-----------------------+                         +-----------------------+
|     GROUP_MEMBER      |                         |   PUSH_SUBSCRIPTION   |
| groupId, userId, role |                         | userId, endpoint, fcm |
+-----------------------+                         +-----------------------+
       | *
       |
       v 1
+-------------------------------------------------------------------------+
|                                 GROUP                                   |
| _id, name, description, currency, createdBy, inviteToken, createdAt     |
+-------------------------------------------------------------------------+
       | 1                                                 | 1
       |                                                   |
       v *                                                 v *
+-----------------------------------+     +-------------------------------+
|              EXPENSE              |     |          SETTLEMENT           |
| groupId, title, amount, paidBy,   |     | groupId, payer, receiver,     |
| splitType, splitDetails: [        |     | amount, paymentMethod, status,|
|   { user, share }                 |     | proofUrl, paidAt, verifiedAt  |
| ], paymentMode, screenshotUrl     |     +-------------------------------+
+-----------------------------------+
```

---

## 12. Verification & Quality Assurance

* **Mathematical Reconciliations**: Automated test suites verify integer-paise split accuracy, remainder distributions, and debt symmetry.
* **TypeScript Strict Compliance**: Client codebase verifies with zero type errors (`npm run typecheck`).
* **Optimized Production Packaging**: Client bundles build with tree-shaking and gzip asset compression (`npm run build`).
* **Cross-Browser Verification**: Fully verified across Chromium, WebKit (iOS Safari), and Firefox desktop and mobile viewports.

## Deploying

### API (Render)

| Setting | Value |
| --- | --- |
| Root directory | `server` |
| Build command | `npm install` |
| Start command | `npm start` |
| Health check | `/api/health` |
| Branch | `v1` |

`npm start` applies database migrations and then boots the server through `tsx`.

The server runs from TypeScript source rather than a compiled `dist/`. Render installs
with `NODE_ENV=production`, which prunes devDependencies — so `typescript` and the
`@types/*` packages a `tsc` build needs are not present at build time. `tsx` is a
runtime dependency and transpiles without them. Types are still enforced, by
`npm run typecheck` and by the test suite, just not on the deploy path.

To compile ahead of time instead, set the build command to
`npm install --include=dev && npm run build` and the start command to
`npm run db:migrate && npm run start:compiled`.

Copy `server/.env.production.example` into the Render environment. `CLIENT_ORIGINS`
must be the exact Vercel origin, with no trailing slash.

### Frontend (Vercel)

| Setting | Value |
| --- | --- |
| Root directory | `client` |
| Build command | `npm run build` |
| Output directory | `dist` |
| Branch | `v1` |

Copy `client/.env.production.example`. Every `VITE_` value is inlined into the bundle
and is therefore public; never put a secret there.

### After the first deploy

```bash
ADMIN_PASSWORD='your-strong-password' npm run db:seed:admin
npm run migrate:group -- --code IOWUVL --dry-run
npm run migrate:group -- --code IOWUVL
```

Both are idempotent: re-running the seed updates the existing administrator, and
re-running the migration creates nothing.
