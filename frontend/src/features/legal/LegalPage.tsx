import Markdown from 'react-markdown';
import { Link, useParams } from 'react-router-dom';
import privacy from '../../../legal/privacy-policy.md?raw';
import terms from '../../../legal/terms-of-service.md?raw';
import acceptableUse from '../../../legal/acceptable-use-policy.md?raw';
import reports from '../../../legal/content-reporting-policy.md?raw';
import storage from '../../../legal/browser-storage-notice.md?raw';
import { legalContactEmail, renderLegalText } from './contact';
import { NotFoundPage } from '../../pages/NotFoundPage';

const documents = [
  {
    slug: 'privacy',
    title: 'Privacy policy',
    summary: 'What we process, why we need it, and your choices.',
    source: privacy,
  },
  {
    slug: 'terms',
    title: 'Terms of service',
    summary: 'Your content, our responsibilities, and using Donee.',
    source: terms,
  },
  {
    slug: 'acceptable-use',
    title: 'Acceptable use',
    summary: 'The boundaries that keep this space safe.',
    source: acceptableUse,
  },
  {
    slug: 'content-reports',
    title: 'Content reports',
    summary: 'Report abuse, illegal content, or a copyright concern.',
    source: reports,
  },
  {
    slug: 'storage',
    title: 'Browser storage',
    summary: 'The small things your browser remembers.',
    source: storage,
  },
];
const headingId = (text: string) =>
  text
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');
export default function LegalPage() {
  const { document: slug } = useParams();
  const selected = documents.find((item) => item.slug === slug);
  if (slug && !selected) return <NotFoundPage />;
  const text = selected ? renderLegalText(selected.source) : '';
  const headings = [...text.matchAll(/^## (.+)$/gm)].map((match) => match[1]!);
  return (
    <main id="main-content" tabIndex={-1} className="legal-page">
      <nav className="legal-breadcrumb" aria-label="Legal breadcrumb">
        <Link to="/">Donee</Link>
        <span aria-hidden="true">/</span>
        <Link to="/legal">Legal</Link>
        {selected && (
          <>
            <span aria-hidden="true">/</span>
            <span>{selected.title}</span>
          </>
        )}
      </nav>
      <p className="eyebrow">YOUR SPACE / THE SMALL PRINT</p>
      {selected ? (
        <div className="legal-layout">
          <article className="legal-copy">
            {slug === 'content-reports' && (
              <nav aria-label="Email a report" className="legal-report-links">
                <p>
                  Choose a topic to open your email app. Nothing is sent until
                  you send the email. Include a short explanation and existing
                  identifiers; do not attach illegal material or credentials.
                </p>
                <ul>
                  {[
                    'Privacy request',
                    'Security concern',
                    'Copyright report',
                    'Intimate image removal',
                    'Child safety concern',
                    'Review a decision',
                    'General support',
                  ].map((topic) => (
                    <li key={topic}>
                      <a
                        href={`mailto:${legalContactEmail}?subject=${encodeURIComponent(topic)}`}
                      >
                        {topic}
                      </a>
                    </li>
                  ))}
                </ul>
                <p>
                  No email app configured? Write to{' '}
                  <a href={`mailto:${legalContactEmail}`}>
                    {legalContactEmail}
                  </a>
                  . This page does not create a case number or confirm delivery.
                </p>
              </nav>
            )}
            <Markdown
              skipHtml
              components={{
                h2: ({ children }) => (
                  <h2 id={headingId(String(children))} tabIndex={-1}>
                    {children}
                  </h2>
                ),
                a: ({ href, children }) =>
                  href?.startsWith('/') ? (
                    <Link to={href}>{children}</Link>
                  ) : (
                    <a href={href} rel="noreferrer">
                      {children}
                    </a>
                  ),
              }}
            >
              {text}
            </Markdown>
            <p className="legal-contact">
              Questions?{' '}
              <a href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>
            </p>
          </article>
          <aside className="legal-contents">
            <nav aria-label="On this page">
              <p className="eyebrow">ON THIS PAGE</p>
              <ol>
                {headings.map((title) => (
                  <li key={title}>
                    <a href={`#${headingId(title)}`}>{title}</a>
                  </li>
                ))}
              </ol>
            </nav>
            <Link to="/legal">All legal documents</Link>
          </aside>
        </div>
      ) : (
        <>
          <h1>A little clarity.</h1>
          <p className="legal-intro">
            Your work belongs to you. These documents explain how Donee handles
            it and what we expect from each other.
          </p>
          <p className="legal-draft">
            Effective October 26, 2026. Version 2026-10-26. Provider settings
            and operational details identified as pending in these documents
            remain pending.
          </p>
          <nav aria-label="Legal documents" className="legal-document-list">
            {documents.map((item, index) => (
              <Link key={item.slug} to={`/legal/${item.slug}`}>
                <span className="legal-number">0{index + 1}</span>
                <span>
                  <strong>{item.title}</strong>
                  <span>{item.summary}</span>
                </span>
                <span aria-hidden="true">↗</span>
              </Link>
            ))}
          </nav>
          <p className="legal-contact">
            Operated by Esteban Jumbo in New Jersey, United States.{' '}
            <a href="https://github.com/tebo-dev" rel="noreferrer">
              Meet the creator
            </a>
            .
          </p>
          <p className="legal-contact">
            Privacy, support, or a content concern:{' '}
            <a href={`mailto:${legalContactEmail}`}>{legalContactEmail}</a>
          </p>
        </>
      )}
    </main>
  );
}
