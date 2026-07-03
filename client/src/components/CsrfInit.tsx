import { useEffect } from 'react';
import { fetchCsrfToken } from '../api/csrf';

export default function CsrfInit() {
  useEffect(() => {
    fetchCsrfToken().catch(() => {});
  }, []);
  return null;
}
