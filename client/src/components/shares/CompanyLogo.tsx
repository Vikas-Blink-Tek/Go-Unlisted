import type { CSSProperties } from 'react';
import type { Share } from '../../types';

type Props = {
  share: Pick<Share, 'name' | 'logoInitials' | 'logoGradient' | 'logoUrl'>;
  className?: string;
  size?: number;
};

/** Company logo image when set; otherwise initials on gradient. */
export default function CompanyLogo({ share, className = '', size }: Props) {
  const style: CSSProperties = {
    background: share.logoUrl ? 'transparent' : (share.logoGradient || 'linear-gradient(135deg, #003478, #0050a8)'),
    ...(size ? { width: size, height: size, minWidth: size, fontSize: size * 0.35 } : {}),
  };

  if (share.logoUrl) {
    const src = share.logoUrl.startsWith('http') || share.logoUrl.startsWith('/')
      ? share.logoUrl
      : `/${share.logoUrl}`;
    return (
      <div className={`company-logo company-logo--img ${className}`.trim()} style={style}>
        <img src={src} alt="" loading="lazy" />
      </div>
    );
  }

  const initials = share.logoInitials
    || share.name.split(/\s+/).map((w) => w[0]).filter(Boolean).join('').slice(0, 2).toUpperCase()
    || '?';

  return (
    <div className={`company-logo ${className}`.trim()} style={style}>
      {initials}
    </div>
  );
}
