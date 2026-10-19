import { useEffect } from 'react';
import { Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { NotFoundPage } from '../pages/NotFoundPage';
import { Brand } from '../components/Brand';
import { Appearance } from '../components/Appearance';
import { AuthLayout } from '../features/auth/AuthLayout';
import { LoginPage } from '../features/auth/LoginPage';
import { RegisterPage } from '../features/auth/RegisterPage';
import {
  ForgotPasswordPage,
  RecoveryFlow,
  ResetPasswordPage,
  VerifyCodePage,
} from '../features/auth/RecoveryPages';
import { SessionGate } from '../features/auth/SessionGate';
import { AccountPage } from '../features/auth/AccountPage';
import { WorkspaceShell } from '../features/workspaces/WorkspaceShell';
import { WorkspaceListPage } from '../features/workspaces/WorkspaceListPage';
import { WorkspacePage } from '../features/workspaces/WorkspacePage';

const titles: Record<string, string> = {
  '/login': 'Sign in',
  '/register': 'Create an account',
  '/forgot-password': 'Recover your account',
  '/verify-reset-code': 'Check your code',
  '/reset-password': 'Choose a password',
  '/account': 'Your account',
};

export function App() {
  const { pathname } = useLocation();
  const workspaceRoute = pathname.startsWith('/workspaces');
  useEffect(() => {
    document.title = `${titles[pathname] || (pathname.startsWith('/workspaces') ? 'Your spaces' : 'A quiet corner')} / Donee`;
    const frame = requestAnimationFrame(() => {
      const target =
        document.querySelector<HTMLElement>('#auth-title') ||
        document.querySelector<HTMLElement>('#main-content');
      target?.focus({ preventScroll: true });
      window.scrollTo(0, 0);
    });
    return () => cancelAnimationFrame(frame);
  }, [pathname]);
  return (
    <div className={`app-shell${workspaceRoute ? ' workspace-app' : ''}`}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Brand />
        <span className="edition">
          {workspaceRoute ? '~/ personal_space' : '[ PERSONAL SPACE ]'}
        </span>
        <Appearance />
      </header>
      <Routes>
        <Route path="/" element={<Navigate to="/login" replace />} />
        <Route element={<AuthLayout />}>
          <Route element={<SessionGate guest />}>
            <Route path="/login" element={<LoginPage />} />
            <Route path="/register" element={<RegisterPage />} />
          </Route>
          <Route element={<RecoveryFlow />}>
            <Route path="/forgot-password" element={<ForgotPasswordPage />} />
            <Route path="/verify-reset-code" element={<VerifyCodePage />} />
            <Route path="/reset-password" element={<ResetPasswordPage />} />
          </Route>
        </Route>
        <Route element={<SessionGate />}>
          <Route path="/account" element={<AccountPage />} />
          <Route path="/workspaces" element={<WorkspaceShell />}>
            <Route index element={<WorkspaceListPage />} />
            <Route path=":workspaceId" element={<WorkspacePage />} />
            <Route
              path=":workspaceId/settings"
              element={<WorkspacePage settings />}
            />
          </Route>
        </Route>
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
      <footer className="app-footer">
        <span>Made for your kind of day.</span>
        <span>DONEE / ONE THING AT A TIME.</span>
      </footer>
    </div>
  );
}
