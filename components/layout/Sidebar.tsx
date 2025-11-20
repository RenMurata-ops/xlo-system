'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Key,
  Users,
  UserPlus,
  UsersRound,
  FileText,
  Zap,
  Repeat,
  MessageSquare,
  Globe,
  ChevronRight,
  Target
} from 'lucide-react';

export default function Sidebar() {
  const pathname = usePathname();

  const menuItems = [
    {
      title: 'ダッシュボード',
      href: '/dashboard',
      icon: <LayoutDashboard size={20} />,
    },
    {
      title: 'アカウント管理',
      items: [
        { title: 'Twitter Apps', href: '/twitter-apps', icon: <Key size={18} /> },
        { title: 'メインアカウント', href: '/accounts/main', icon: <Users size={18} /> },
        { title: 'フォローアカウント', href: '/accounts/follow', icon: <UserPlus size={18} /> },
        { title: 'スパムアカウント', href: '/accounts/spam', icon: <UsersRound size={18} /> },
      ],
    },
    {
      title: 'コンテンツ',
      items: [
        { title: '投稿管理', href: '/posts', icon: <MessageSquare size={18} /> },
        { title: 'テンプレート', href: '/templates', icon: <FileText size={18} /> },
      ],
    },
    {
      title: '自動化',
      items: [
        { title: 'エンゲージメント', href: '/engagement', icon: <Zap size={18} /> },
        { title: 'ターゲット', href: '/engagement/targeted', icon: <Target size={18} /> },
        { title: 'ループ', href: '/loops', icon: <Repeat size={18} /> },
      ],
    },
    {
      title: 'インフラ',
      items: [
        { title: 'プロキシ', href: '/proxies', icon: <Globe size={18} /> },
      ],
    },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <div className="hidden lg:flex flex-col w-64 bg-gray-900 border-r border-gray-800 h-screen fixed left-0 top-0">
      <div className="p-6 border-b border-gray-800">
        <h1 className="text-2xl font-bold text-white">XLO System</h1>
        <p className="text-sm text-gray-400 mt-1">Twitter Automation</p>
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-3">
        {menuItems.map((section, idx) => (
          <div key={idx} className="mb-6">
            {section.title && !section.href ? (
              <div className="px-3 mb-2">
                <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {section.title}
                </h3>
              </div>
            ) : section.href ? (
              <Link
                href={section.href}
                className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                  isActive(section.href)
                    ? 'bg-blue-600 text-white'
                    : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                }`}
              >
                {section.icon}
                <span className="font-medium">{section.title}</span>
              </Link>
            ) : null}

            {section.items && (
              <div className="space-y-1">
                {section.items.map((item, itemIdx) => (
                  <Link
                    key={itemIdx}
                    href={item.href}
                    className={`flex items-center gap-3 px-3 py-2 rounded-lg transition-colors ${
                      isActive(item.href)
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-300 hover:bg-gray-800 hover:text-white'
                    }`}
                  >
                    {item.icon}
                    <span className="text-sm">{item.title}</span>
                    {isActive(item.href) && (
                      <ChevronRight size={16} className="ml-auto" />
                    )}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </nav>

      <div className="p-4 border-t border-gray-800">
        <div className="text-xs text-gray-500 text-center">
          v1.0.0 | © 2025 XLO System
        </div>
      </div>
    </div>
  );
}
