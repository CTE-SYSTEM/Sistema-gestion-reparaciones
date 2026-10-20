import { useEffect, useState } from 'react';

// Usa los avisos de la conexión existente y una comprobación periódica de respaldo.
export function useAreaRefresh({ enabled = true, intervalMs = 60000 } = {}) {
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    if (!enabled) return undefined;
    let timer;
    const refresh = () => {
      if (document.hidden) return;
      clearTimeout(timer);
      timer = setTimeout(() => setRevision((value) => value + 1), 700);
    };
    const interval = setInterval(refresh, intervalMs);
    window.addEventListener('sgr:data-changed', refresh);
    window.addEventListener('focus', refresh);
    document.addEventListener('visibilitychange', refresh);
    return () => {
      clearTimeout(timer);
      clearInterval(interval);
      window.removeEventListener('sgr:data-changed', refresh);
      window.removeEventListener('focus', refresh);
      document.removeEventListener('visibilitychange', refresh);
    };
  }, [enabled, intervalMs]);
  return revision;
}
