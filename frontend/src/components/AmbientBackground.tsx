import { useEffect, useRef } from 'react';

const scenes = {
  koi: { animal: 'koi', background: [11, 23, 25] },
  abyss: { animal: 'jellyfish', background: [15, 16, 37] },
  firefly: { animal: 'dragonflies', background: [17, 23, 14] },
  sky: { animal: 'cranes', background: [32, 42, 53] },
} as const;
export function AmbientBackground({
  theme,
  paused,
}: {
  theme: string;
  paused: boolean;
}) {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    if (!window.matchMedia) return;
    let cancelled = false;
    let dispose: (() => void) | undefined;
    void import('../vendor/ascii-animals/renderer.js')
      .then(({ createAnimalScene }) => {
        if (cancelled || !ref.current) return;
        const scene = scenes[theme as keyof typeof scenes] || scenes.koi;
        dispose = createAnimalScene(ref.current, {
          animal: scene.animal,
          background: [...scene.background],
          paused,
        });
      })
      .catch(() => {
        /* A solid theme remains usable if decoration cannot load. */
      });
    return () => {
      cancelled = true;
      dispose?.();
    };
  }, [theme, paused]);
  return <canvas ref={ref} className="ambient-background" aria-hidden="true" />;
}
