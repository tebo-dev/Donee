import { Route, Routes } from 'react-router-dom';
import { FoundationPage } from '../pages/FoundationPage';
import { NotFoundPage } from '../pages/NotFoundPage';
import { Brand } from '../components/Brand';

export function App() {
  return (
    <>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <header className="app-header">
        <Brand />
        <span className="edition">MATRIX / PERSONAL SPACE</span>
      </header>
      <Routes>
        <Route path="/" element={<FoundationPage />} />
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
}
