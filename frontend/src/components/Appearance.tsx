import { useEffect, useRef, useState } from 'react';
import { Palette } from '@phosphor-icons/react/dist/csr/Palette';
import { X } from '@phosphor-icons/react/dist/csr/X';
import { Link } from 'react-router-dom';

const themes = ['matrix', 'terminal', 'dracula', 'akira'] as const;
const fonts = ['plex', 'fira'] as const;
const key = 'donee-appearance';
function read() {
  try {
    const value = JSON.parse(localStorage.getItem(key) || '{}') as Record<
      string,
      unknown
    >;
    return {
      theme: themes.find((theme) => theme === value.theme) || 'matrix',
      font: fonts.find((font) => font === value.font) || 'plex',
      remember: themes.some((theme) => theme === value.theme),
    };
  } catch {
    return { theme: 'matrix' as const, font: 'plex' as const, remember: false };
  }
}

export function Appearance() {
  const [value, setValue] = useState(read);
  const [saved, setSaved] = useState(true);
  const dialog = useRef<HTMLDialogElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    function onStorage(event: StorageEvent) {
      if (event.key === key || event.key === null) {
        // Respect another tab clearing the saved preference without changing this tab's theme.
        if (event.newValue === null)
          setValue((current) => ({ ...current, remember: false }));
      }
    }
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = value.theme;
    document.documentElement.dataset.font = value.font;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute(
        'content',
        getComputedStyle(document.documentElement)
          .getPropertyValue('--color-bg')
          .trim(),
      );
  }, [value]);
  function update(next: typeof value) {
    setValue(next);
    try {
      if (next.remember)
        localStorage.setItem(
          key,
          JSON.stringify({ theme: next.theme, font: next.font }),
        );
      else localStorage.removeItem(key);
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }
  return (
    <>
      <button
        ref={trigger}
        type="button"
        className="appearance-trigger"
        onClick={() => dialog.current?.showModal()}
      >
        <Palette size={17} aria-hidden="true" />
        Appearance
      </button>
      <dialog
        ref={dialog}
        className="appearance-dialog"
        aria-labelledby="appearance-title"
        onClose={() => trigger.current?.focus()}
        onClick={(event) => {
          if (event.target === dialog.current) {
            const bounds = dialog.current.getBoundingClientRect();
            if (
              event.clientX < bounds.left ||
              event.clientX > bounds.right ||
              event.clientY < bounds.top ||
              event.clientY > bounds.bottom
            )
              dialog.current.close();
          }
        }}
      >
        <div className="appearance-heading">
          <div>
            <span className="eyebrow">MAKE YOURSELF AT HOME</span>
            <h2 id="appearance-title">Your kind of quiet.</h2>
          </div>
          <button
            className="icon-button"
            onClick={() => dialog.current?.close()}
            aria-label="Close appearance"
          >
            <X size={20} />
          </button>
        </div>
        <fieldset>
          <legend>Color theme</legend>
          <div className="theme-choices">
            {themes.map((theme) => (
              <button
                key={theme}
                data-palette={theme}
                aria-pressed={value.theme === theme}
                onClick={() => update({ ...value, theme })}
              >
                <span className="theme-swatch" aria-hidden="true" />
                {theme[0]?.toUpperCase()}
                {theme.slice(1)}
                <span aria-hidden="true">
                  {value.theme === theme ? '●' : '○'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <fieldset>
          <legend>
            Typeface <span className="muted">/ inputs & small details</span>
          </legend>
          <div className="font-choices">
            {fonts.map((font) => (
              <button
                key={font}
                className={`font-${font}`}
                aria-pressed={value.font === font}
                onClick={() => update({ ...value, font })}
              >
                <span className="font-sample" aria-hidden="true">
                  Aa
                </span>
                <span>
                  {font === 'plex' ? 'IBM Plex Mono' : 'Fira Code'}
                  <small>
                    {font === 'plex'
                      ? 'A little warmth in the terminal.'
                      : 'Crisp characters. Familiar rhythm.'}
                  </small>
                </span>
                <span aria-hidden="true">
                  {value.font === font ? '●' : '○'}
                </span>
              </button>
            ))}
          </div>
        </fieldset>
        <label className="registration-age">
          <input
            type="checkbox"
            checked={value.remember}
            onChange={(event) =>
              update({ ...value, remember: event.target.checked })
            }
          />
          <span>Remember appearance on this device</span>
        </label>
        <p className="appearance-note" role="status">
          {!saved
            ? 'Browser storage could not be updated. Clear this site’s data in browser settings to remove older saved choices.'
            : value.remember
              ? 'Your theme and font are saved on this device. Turn this off to remove them.'
              : 'Your choices apply until you reload. No appearance preference is saved.'}
        </p>
        <p className="appearance-note">
          <Link to="/legal/storage" onClick={() => dialog.current?.close()}>
            About browser storage
          </Link>
        </p>
        <button className="primary" onClick={() => dialog.current?.close()}>
          Feels like me <span aria-hidden="true">↵</span>
        </button>
      </dialog>
    </>
  );
}
