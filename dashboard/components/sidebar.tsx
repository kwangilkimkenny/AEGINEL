'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  Shield,
  BarChart3,
  ScrollText,
  FileText,
  Users,
  Settings,
  LogOut,
} from 'lucide-react';
import { cn } from '@/lib/utils';

const navigation = [
  { name: '대시보드', href: '/', icon: BarChart3 },
  { name: '정책 관리', href: '/policies', icon: Shield },
  { name: '분석', href: '/analytics', icon: BarChart3 },
  { name: '감사 로그', href: '/audit', icon: ScrollText },
  { name: '리포트', href: '/reports', icon: FileText },
  { name: '사용자 관리', href: '/users', icon: Users },
];

export default function Sidebar() {
  const pathname = usePathname();

  const handleLogout = async () => {
    await fetch('/api/auth/logout', { method: 'POST' });
    window.location.href = '/login';
  };

  return (
    <div className="flex h-screen w-64 flex-col bg-zinc-950 border-r border-zinc-800">
      <div className="flex h-16 items-center gap-2 px-6 border-b border-zinc-800">
        <Shield className="h-7 w-7 text-emerald-500" />
        <span className="text-lg font-bold text-white tracking-tight">AEGINEL</span>
        <span className="ml-1 rounded bg-emerald-500/10 px-1.5 py-0.5 text-[10px] font-medium text-emerald-400 uppercase tracking-wider">
          Admin
        </span>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navigation.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href !== '/' && pathname.startsWith(item.href));

          return (
            <Link
              key={item.name}
              href={item.href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors',
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200'
              )}
            >
              <item.icon className="h-4.5 w-4.5" />
              {item.name}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-zinc-800 p-3 space-y-1">
        <Link
          href="/policies"
          className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-zinc-800/50 hover:text-zinc-200 transition-colors"
        >
          <Settings className="h-4.5 w-4.5" />
          설정
        </Link>
        <button
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-zinc-400 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer"
        >
          <LogOut className="h-4.5 w-4.5" />
          로그아웃
        </button>
      </div>
    </div>
  );
}
