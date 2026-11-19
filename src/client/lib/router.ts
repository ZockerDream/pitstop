import { useEffect, useState } from 'react';

// Hash-Router: #/kunden/<id>, #/finanzen/rechnungen?status=overdue … (TECHNICAL.md 8.1)

export interface Route {
  path: string;
  segments: string[];
  query: URLSearchParams;
}

function parse(): Route {
  const raw = window.location.hash.replace(/^#/, '') || '/dashboard';
  const [pathPart, queryPart = ''] = raw.split('?');
  const path = pathPart.startsWith('/') ? pathPart : `/${pathPart}`;
  const segments = path.split('/').filter(Boolean);
  return { path, segments: segments.length ? segments : ['dashboard'], query: new URLSearchParams(queryPart) };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(parse);
  useEffect(() => {
    const onChange = () => setRoute(parse());
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);
  return route;
}

export function navigate(path: string): void {
  const target = path.startsWith('#') ? path : `#${path.startsWith('/') ? path : `/${path}`}`;
  if (window.location.hash !== target) window.location.hash = target;
}

export function href(path: string): string {
  return `#${path.startsWith('/') ? path : `/${path}`}`;
}
