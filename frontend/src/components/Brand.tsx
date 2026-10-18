import { Link } from 'react-router-dom';
import { PixelComputer } from './PixelComputer';

export function Brand() {
  return (
    <Link className="brand" to="/" aria-label="Donee home">
      <PixelComputer />
      <span>
        donee<span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
