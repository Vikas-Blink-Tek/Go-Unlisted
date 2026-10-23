import { useState } from 'react';
import { mediaUrl } from '../../utils/mediaUrl';

type Props = {
  path?: string | null;
  alt: string;
  className?: string;
  eager?: boolean;
};

/**
 * Article cover that never crops: the image is fitted whole (portrait phone shots and wide banners alike)
 * over a blurred copy of itself that fills the empty space.
 */
export default function ArticleMedia({ path, alt, className = '', eager = false }: Props) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(path);

  if (!src || failed) {
    return (
      <div className={`article-media article-img-placeholder ${className}`.trim()} role="img" aria-label={alt || 'Article'}>
        <span>📰</span>
      </div>
    );
  }

  return (
    <div className={`article-media ${className}`.trim()}>
      <img src={src} alt="" aria-hidden className="article-media-bg" loading={eager ? 'eager' : 'lazy'} />
      <img
        src={src}
        alt={alt}
        className="article-media-img"
        loading={eager ? 'eager' : 'lazy'}
        onError={() => setFailed(true)}
      />
    </div>
  );
}
