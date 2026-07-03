import type { AdminPanelId } from '../../context/AdminPanelContext';

const ICONS: Record<AdminPanelId, string> = {
  dashboard: '◫',
  pending: '◎',
  initiated: '↩',
  orders: '☰',
  'manual-order': '✎',
  'cancel-refund': '↺',
  users: '◉',
  employees: '⊞',
  prices: '◈',
  articles: '¶',
  reports: '▤',
  settings: '⚙',
};

export function adminNavIcon(id: AdminPanelId): string {
  return ICONS[id] || '•';
}
