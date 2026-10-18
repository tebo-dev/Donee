import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <main id="main-content" className="foundation-page" tabIndex={-1}>
      <p className="eyebrow">404 / A QUIET CORNER</p>
      <h1>
        Nothing here. <br />
        <span>Not just yet.</span>
      </h1>
      <p className="intro">
        This page doesn't exist. Head back to your starting point.
      </p>
      <Link className="text-link" to="/">
        Back to Donee <span aria-hidden="true">↗</span>
      </Link>
    </main>
  );
}
