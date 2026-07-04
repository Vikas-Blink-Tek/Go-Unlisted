import { useEffect, useState, type CSSProperties } from 'react';
import type { Share } from '../../types';

type Props = {
  share: Pick<Share, 'name' | 'logoInitials' | 'logoGradient' | 'logoUrl'>;
  className?: string;
  size?: number;
};

function logoSrc(logoUrl: string): string {
  const path = logoUrl.trim();
  if (!path) return '';
  if (path.startsWith('http://') || path.startsWith('https://') || path.startsWith('data:')) {
    return path;
  }
  const clean = path.replace(/^\/+/, '');
  return `/${clean}`;
}

export function initialsFromName(name: string, fallback = '?'): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) {
    return (parts[0][0] + parts[1][0]).toUpperCase();
  }
  const clean = name.replace(/[^a-zA-Z0-9]/g, '');
  if (clean.length >= 2) return clean.slice(0, 2).toUpperCase();
  if (clean.length === 1) return (clean + clean).toUpperCase();
  return fallback;
}

function initialsFor(share: Props['share']): string {
  const fromField = (share.logoInitials || '').replace(/[^a-zA-Z0-9]/g, '').slice(0, 5).toUpperCase();
  if (fromField) return fromField;
  return initialsFromName(share.name);
}

/** Company logo image when set; otherwise initials on gradient. */
export default function CompanyLogo({ share, className = '', size }: Props) {
  const [imgFailed, setImgFailed] = useState(false);
  const src = share.logoUrl ? logoSrc(share.logoUrl) : '';
  const showImg = Boolean(src) && !imgFailed;

  useEffect(() => {
    setImgFailed(false);
  }, [share.logoUrl, share.logoInitials, share.name]);

  const style: CSSProperties = {
    background: showImg ? '#fff' : (share.logoGradient || 'linear-gradient(135deg, #003478, #0050a8)'),
    ...(size ? { width: size, height: size, minWidth: size, fontSize: size * 0.35 } : {}),
  };

  if (showImg) {
    return (
      <div className={`company-logo company-logo--img ${className}`.trim()} style={style}>
        <img
          src={src}
          alt={share.name}
          loading="lazy"
          decoding="async"
          onError={() => setImgFailed(true)}
        />
      </div>
    );
  }

  return (
    <div className={`company-logo ${className}`.trim()} style={style}>
      {initialsFor(share)}
    </div>
  );
}
