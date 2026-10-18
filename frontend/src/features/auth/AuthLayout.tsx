import { Outlet } from 'react-router-dom';
import { PixelComputer } from '../../components/PixelComputer';

export function AuthLayout() {
  return (
    <main id="main-content" className="auth-layout" tabIndex={-1}>
      <section className="auth-story" aria-label="A little room for your day">
        <p className="eyebrow">YOUR MIND, WITH A LITTLE MORE ROOM.</p>
        <h1>
          Less noise. <br />
          <span>More doing.</span>
        </h1>
        <p className="story-description">
          A quiet place for the things you want to do. Make a little space. Pick
          a task. Find your flow.
        </p>
        <div className="companion-scene">
          <PixelComputer large />
          <div>
            <span className="eyebrow">YOUR LITTLE CORNER</span>
            <p>
              Old-school hardware.
              <br />
              Good company.
            </p>
            <span className="companion-prompt">&gt; ready when you are_</span>
          </div>
        </div>
        <div className="terminal-art" aria-hidden="true">
          <div className="terminal-heading">
            <span>~/a_little_room</span>
            <span>— □ ×</span>
          </div>
          <div className="terminal-lines">
            <p>
              <span>~</span> donee start
            </p>
            <p className="muted">Loading the things that matter...</p>
            <p>✓ A place for your ideas</p>
            <p>✓ A little less mental clutter</p>
            <p>✓ Everything at your fingertips</p>
            <p className="terminal-ready">
              Ready when you are.
              <span className="block-cursor" />
            </p>
          </div>
        </div>
        <p className="story-foot">
          <span className="status-dot" />
          Your tasks. Your pace. Your corner of the internet.
        </p>
      </section>
      <div className="auth-form-wrap">
        <Outlet />
      </div>
    </main>
  );
}
