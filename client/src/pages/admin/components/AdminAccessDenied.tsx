import { useAdminPanel, ADMIN_PANELS } from '../../../context/AdminPanelContext';

export default function AdminAccessDenied() {
  const { activePanel, setActivePanel, allowedPanels } = useAdminPanel();
  const label = ADMIN_PANELS.find((p) => p.id === activePanel)?.label || activePanel;

  return (
    <div className="admin-access-denied">
      <div className="admin-access-denied-icon" aria-hidden>🔒</div>
      <h2>Access denied</h2>
      <p>
        You do not have permission to open <strong>{label}</strong>.
        Admin URLs cannot bypass your assigned role — all actions are verified on the server.
      </p>
      <button
        type="button"
        className="btn btn-primary btn-sm"
        onClick={() => setActivePanel(allowedPanels[0]?.id || 'dashboard')}
      >
        Go to your dashboard
      </button>
    </div>
  );
}
