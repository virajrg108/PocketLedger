import {
  createHashRouter,
  RouterProvider,
  Outlet,
  Link,
  useLocation
} from "react-router-dom";
import { PlusCircle, LayoutDashboard, BarChart3, Settings as SettingsIcon } from "lucide-react";

import { Dashboard } from "./pages/Dashboard";
import { TransactionForm } from "./pages/TransactionForm";
import { Settings } from "./pages/Settings";
import { Reports } from "./pages/Reports";

function Layout() {
  const location = useLocation();

  return (
    <div className="flex flex-col min-h-screen bg-zinc-950 text-zinc-50 font-sans pb-20 md:pb-0 md:flex-row">
      {/* Desktop Sidebar / Mobile Bottom Nav Placeholder */}
      <nav className="fixed bottom-0 w-full bg-zinc-900 border-t border-zinc-800 md:relative md:w-64 md:border-t-0 md:border-r flex md:flex-col justify-around md:justify-start p-2 z-50">
        <div className="hidden md:block mb-8 px-2">
          <h1 className="text-xl font-bold tracking-tight">PocketLedger</h1>
        </div>

        <Link
          to="/"
          className={`flex items-center justify-center p-3 md:p-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'}`}
        >
          <LayoutDashboard className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Dashboard</span>
        </Link>

        <Link
          to="/reports"
          className={`flex items-center justify-center p-3 md:p-2 md:mt-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/reports' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'}`}
        >
          <BarChart3 className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Reports</span>
        </Link>

        <Link
          to="/settings"
          className={`flex items-center justify-center p-3 md:p-2 md:mt-2 md:justify-start rounded-lg transition-colors ${location.pathname === '/settings' ? 'text-emerald-400 bg-emerald-400/10' : 'text-zinc-400 hover:text-zinc-50 hover:bg-zinc-800'}`}
        >
          <SettingsIcon className="w-5 h-5 md:mr-3" />
          <span className="hidden md:block text-sm font-medium">Settings</span>
        </Link>

        <div className="md:mt-auto py-2">
          <Link
            to="/add"
            className="flex items-center justify-center p-3 md:p-2 bg-emerald-500 hover:bg-emerald-600 text-zinc-950 rounded-full shadow-lg transition-transform hover:scale-105"
          >
            <PlusCircle className="w-5 h-5 md:mr-2" />
            <span className="hidden md:inline font-semibold">New Entry</span>
          </Link>
        </div>
      </nav>

      <main className="flex-1 w-full max-w-5xl mx-auto md:p-8">
        <Outlet />
      </main>
    </div>
  );
}

const router = createHashRouter([
  {
    path: "/",
    element: <Layout />,
    children: [
      {
        index: true,
        element: <Dashboard />,
      },
      {
        path: "add",
        element: <TransactionForm />,
      },
      {
        path: "edit/:id",
        element: <TransactionForm />,
      },
      {
        path: "reports",
        element: <Reports />,
      },
      {
        path: "settings",
        element: <Settings />,
      },
    ],
  },
]);

function App() {
  return <RouterProvider router={router} />;
}

export default App;
