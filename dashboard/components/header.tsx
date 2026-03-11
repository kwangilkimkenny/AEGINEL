'use client';

import { useEffect, useState } from 'react';

interface Session {
  adminId: string;
  email: string;
  orgId: string;
  orgName: string;
}

export default function Header() {
  const [session, setSession] = useState<Session | null>(null);

  useEffect(() => {
    fetch('/api/auth/me')
      .then((r) => r.json())
      .then((data) => setSession(data.session))
      .catch(() => {});
  }, []);

  return (
    <header className="flex h-16 items-center justify-between border-b border-zinc-200 bg-white px-8">
      <div />
      <div className="flex items-center gap-4">
        {session && (
          <div className="text-right">
            <p className="text-sm font-medium text-zinc-900">{session.orgName}</p>
            <p className="text-xs text-zinc-500">{session.email}</p>
          </div>
        )}
        <div className="h-9 w-9 rounded-full bg-emerald-100 flex items-center justify-center">
          <span className="text-sm font-medium text-emerald-700">
            {session?.email?.charAt(0).toUpperCase() || 'A'}
          </span>
        </div>
      </div>
    </header>
  );
}
