import { useState } from 'react';
import { mediaUrl } from '../../utils/mediaUrl';

type Props = {
  path?: string | null;
  alt: string;
  className?: string;
  /** Used on detail hero */
  motion?: boolean;
};

/** Article cover — falls back to placeholder when file is missing (common after uploads/ wipe). */
export default function ArticleCoverImage({ path, alt, className = 'article-img' }: Props) {
  const [failed, setFailed] = useState(false);
  const src = mediaUrl(path);

  if (!src || failed) {
    return (
      <div className={`${className} article-img-placeholder`} role="img" aria-label={alt || 'Article'}>
        <span>📰</span>
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      className={className}
      loading="lazy"
      decoding="async"
      onError={() => setFailed(true)}
    />
  );
}
