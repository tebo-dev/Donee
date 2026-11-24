export function createAnimalScene(
  canvas: HTMLCanvasElement,
  options: {
    animal: 'koi' | 'jellyfish' | 'dragonflies' | 'cranes';
    background: [number, number, number];
    paused: boolean;
  },
): () => void;
