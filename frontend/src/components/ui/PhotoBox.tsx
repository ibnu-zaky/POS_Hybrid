// components/ui/PhotoBox.tsx
type Props = {
  src?: string;
  alt: string;
  category?: string;
  /** kelas tambahan (th untuk tabel, dst.) */
  className?: string;
};

export function PhotoBox({ src, alt, category, className = "" }: Props) {
  if (src) {
    return (
      <span className={`photo ${className}`.trim()}>
        <img src={src} alt={`Foto ${alt}`} />
      </span>
    );
  }

  return (
    <span className={`photo none ${className}`.trim()}>
      <svg className="ic" viewBox="0 0 64 64" aria-hidden="true">
        <g fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round">
          <path d="M8 32L32 8h22v22L30 54z" />
          <circle cx="44" cy="20" r="3" />
        </g>
      </svg>
      <small>Belum ada foto</small>
      {category && <small>{category}</small>}
    </span>
  );
}
