import type { ReactNode } from 'react';
import { Navigate, Outlet, Route, Routes } from 'react-router';
import { AccountsPage } from '../features/accounts/AccountsPage';
import { CategoriesPage } from '../features/categories/CategoriesPage';
import { ConnectPage } from '../features/connect/ConnectPage';
import { DashboardPage } from '../features/dashboard/DashboardPage';
import { ImportPage } from '../features/import/ImportPage';
import { LandingPage } from '../features/landing/LandingPage';
import { PrivacyPage } from '../features/legal/PrivacyPage';
import { TermsPage } from '../features/legal/TermsPage';
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
      <Route path={paths.privacy} element={<PrivacyPage />} />
      <Route path={paths.terms} element={<TermsPage />} />
      <Route element={<RequireConnection />}>
        <Route path={paths.accounts} element={<AccountsPage />} />
        <Route path={`${paths.accounts}/:accountId`} element={<AccountsPage />} />
        <Route path={paths.categories} element={<CategoriesPage />} />
        <Route path={paths.import} element={<ImportPage />} />
      </Route>
      <Route path="*" element={<Navigate to={paths.home} replace />} />
    </Routes>
  );
}
