# PocketLedger

PocketLedger is a fast, offline-first Progressive Web App (PWA) designed for logging and managing your daily financial transactions. By leveraging browser-native local storage (IndexedDB), PocketLedger keeps your financial data completely private and instantly accessible, even without an internet connection. No accounts, no servers, and zero latency.

## Key Features

- **Offline-First PWA:** Install it directly onto your desktop or mobile device. Run it without internet perfectly fine.
- **Dynamic Dashboard:** A beautiful, intuitive overview showing real-time balances across your custom accounts (Bank, Credit Card, Cash, etc.) and recent history.
- **Cash Flow Types:** Easily manage `Debit` (Expenses), `Credit` (Income), and `Transfer` (internal movements between accounts) types.
- **Budgeting Categories:** Tag your debit expenses as a `Need`, a `Want`, or `Other` to better understand your spending habits.
- **Detailed Analytics:** Flexible date-range filters allow you to view specific transactions and calculate total income, total expense, and net flow for any period.
- **Excel Exports:** Instantly export your filtered transaction logs directly to `.xlsx` format for your own records.
- **Data Privacy:** Your data never leaves your device. All transactions are stored locally in your browser's IndexedDB.

## Tech Stack

- **Framework:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + Shadcn UI
- **Database:** Dexie (IndexedDB wrapper)
- **Exports:** SheetJS (`xlsx`)
- **Routing:** React Router DOM
- **Date Handling:** date-fns

## Getting Started

To run PocketLedger locally for development:

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```
3. Start the development server:
   ```bash
   npm run dev
   ```

## Production Build

To build the app for production (generating the service workers and PWA manifests):

```bash
npm run build
```

Then serve the generated `dist` folder using any static file server (for example, `npx serve -s dist`).

## How to Use (Mobile Guide)

PocketLedger is optimized for mobile screens. Below is a quick overview of how to navigate and use the core features on your phone:

### 1. Initial Setup (Settings)
Start by navigating to the **Settings** tab. Here, you can configure your custom accounts (like your checking account, wallet, or credit card) and set their initial real-world balances.

<p align="center">
  <!-- 📱 Suggested Screenshot: Settings screen showing Account configuration -->
  <img src="./public/screenshots/settings.png" alt="Settings Page" width="250" />
</p>

### 2. Logging Transactions (New Entry)
Tap the green **New Entry** button to log a transaction. 
- Log your daily expenses as a **Debit**.
- Log your income as a **Credit**.
- Use **Transfer** when paying off your credit card from your bank account. Transfers safely move money between your accounts without artificially inflating your total monthly expenses!

<p align="center">
  <!-- 📱 Suggested Screenshot: Add Transaction screen filled out -->
  <img src="./public/screenshots/new-entry.png" alt="New Entry Page" width="250" />
</p>

### 3. Monitoring Finances (Dashboard)
Your **Dashboard** instantly updates to reflect your total available balances and a chronological list of your most recent transactions.

<p align="center">
  <!-- 📱 Suggested Screenshot: Dashboard showing balances and recent history -->
  <img src="./public/screenshots/dashboard.png" alt="Dashboard Page" width="250" />
</p>

### 4. Analyzing Data (Reports)
Use the **Reports** tab to filter your semantic history by date range. It will calculate your total income, expense, and net flow for that exact timeframe, and you can export the specific snapshot to an Excel file for backup.

<p align="center">
  <!-- 📱 Suggested Screenshot: Reports screen with date filter active -->
  <img src="./public/screenshots/reports.png" alt="Reports Page" width="250" />
</p>
