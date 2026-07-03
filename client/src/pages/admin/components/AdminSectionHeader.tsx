export default function AdminSectionHeader({
  title,
  subtitle,
  badge,
  action,
  compact,
}: {
  title: string;
  subtitle?: string;
  badge?: string;
  action?: React.ReactNode;
  /** Hide large title when topbar already shows the same label */
  compact?: boolean;
}) {
  return (
    <div className={`admin-section-header${compact ? ' admin-section-header--compact' : ''}`}>
      <div>
        {!compact && <div className="admin-section-title">{title}</div>}
        {subtitle && <div className="admin-section-subtitle">{subtitle}</div>}
        {compact && !subtitle && <div className="admin-section-subtitle">{title}</div>}
      </div>
      <div className="admin-section-header-actions">
        {badge && <span className="orders-count-badge">{badge}</span>}
        {action}
      </div>
    </div>
  );
}
