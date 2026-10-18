import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AccountsOverviewPage } from '../features/accounts/AccountsOverviewPage';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { ConnectPage } from '../features/connect/ConnectPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { LandingPage } from '../features/landing/LandingPage';
import { LedgerDataProvider } from '../state/ledgerData';
import { useSession } from '../state/session';
import { AppShell } from './AppShell';
import { paths } from './paths';

function ConnectedLayout({ children }: { children: ReactNode }) {
  return (
    <LedgerDataProvider>
      <AppShell>{children}</AppShell>
    </LedgerDataProvider>
  );
}

/** Only renders its children once a spreadsheet is connected; otherwise sends the user home. */
function RequireConnection() {
  const { session } = useSession();
  if (session.status === 'signed-out') return <Navigate to={paths.home} replace />;
  if (session.status === 'signed-in') return <Navigate to={paths.connect} replace />;
  return (
    <ConnectedLayout>
      <Outlet />
    </ConnectedLayout>
  );
}

/** `/` is the landing page when signed out and the dashboard once connected. */
function Home() {
  const { session } = useSession();
  if (session.status === 'signed-out') return <LandingPage />;
  if (session.status === 'signed-in') return <Navigate to={paths.connect} replace />;
  return (
    <ConnectedLayout>
      <DashboardPage />
    </ConnectedLayout>
  );
}

export function AppRoutes() {
  return (
    <Routes>
      <Route path={paths.home} element={<Home />} />
      <Route path={paths.connect} element={<ConnectPage />} />
      <Route element={<RequireConnection />}>
        <Route path={paths.accounts} element={<AccountsOverviewPage />} />
        <Route path={`${paths.accounts}/:accountId`} element={<AccountsPage />} />
        <Route path={paths.categories} element={<CategoriesPage />} />
        {/* Importing now happens from each account page. */}
        <Route path="/import" element={<Navigate to={paths.accounts} replace />} />
      </Route>
      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Routes>
  );
}
