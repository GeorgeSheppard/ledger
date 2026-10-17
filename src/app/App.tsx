import { BrowserRouter } from 'react-router';
import { SessionProvider } from '../state/session';
import { ShortcutProvider } from '../state/shortcuts';
import { AppRoutes } from './routes';

export function App() {
  return (
    <BrowserRouter>
      <SessionProvider>
        <ShortcutProvider>
          <AppRoutes />
        </ShortcutProvider>
      </SessionProvider>
    </BrowserRouter>
  );
}
