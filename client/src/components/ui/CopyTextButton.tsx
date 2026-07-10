import { useState, type MouseEvent } from 'react';
import { useToast } from '../../context/ToastContext';

type Props = {
  value: string;
  label?: string;
  className?: string;
};

/** Compact copy control for IDs (order, UTR, etc.) in admin tables. */
export default function CopyTextButton({ value, label = 'Copied', className = '' }: Props) {
  const { showToast } = useToast();
  const [copied, setCopied] = useState(false);

  if (!value || value === '—') return null;

  const copy = async (e: MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      showToast(label, 'success');
      window.setTimeout(() => setCopied(false), 1500);
    } catch {
      showToast('Could not copy — select and copy manually', 'error');
    }
  };

  return (
    <button
      type="button"
      className={`admin-copy-btn ${className}`.trim()}
      onClick={copy}
      title={`Copy ${value}`}
      aria-label={`Copy ${value}`}
    >
      {copied ? '✓' : 'Copy'}
    </button>
  );
}
