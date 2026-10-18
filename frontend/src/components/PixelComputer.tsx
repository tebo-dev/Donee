const pixels = [
  '011111111110',
  '110000000011',
  '102222222201',
  '102112211201',
  '102112211201',
  '102222222201',
  '102211112201',
  '102222222201',
  '111111111111',
  '110000011011',
  '011111111110',
  '001111111100',
].join('');

export function PixelComputer({ large = false }: { large?: boolean }) {
  return (
    <span
      className={`pixel-computer${large ? ' computer-large' : ''}`}
      aria-hidden="true"
    >
      {Array.from(pixels, (pixel, index) => (
        <i key={index} data-pixel={pixel} />
      ))}
    </span>
  );
}
