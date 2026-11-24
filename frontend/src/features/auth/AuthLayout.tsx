import { Outlet } from 'react-router-dom';

export function AuthLayout() {
  return (
    <main id="main-content" className="auth-layout" tabIndex={-1}>
      <section className="auth-story" aria-label="A little room for your day">
        <h1>
          Less noise. <br />
          <span>More doing.</span>
        </h1>
        <p className="story-description">Your tasks, in one place.</p>
      </section>
      <div className="auth-form-wrap">
        <Outlet />
      </div>
    </main>
  );
}
