const pixels = [
  '000011110000',
  '001111111100',
  '011111111110',
  '011111111110',
  '111001100111',
  '111001100111',
  '111111111111',
  '111100111111',
  '111111111111',
  '111111111111',
  '111001100111',
  '110001100011',
].join('');

export function PixelGhost() {
  return (
    <span className="pixel-ghost" aria-hidden="true">
      {Array.from(pixels, (pixel, index) => (
        <span key={index} data-filled={pixel === '1'} />
      ))}
    </span>
  );
}
