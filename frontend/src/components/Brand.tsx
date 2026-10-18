import { Link } from 'react-router-dom';
import { PixelGhost } from './PixelGhost';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Donee home">
      <PixelGhost />
      <span>
        donee<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
