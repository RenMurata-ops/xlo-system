'use client';

import Link from 'next/link';
import { Plus, Users, FileText, Zap, Repeat, MessageCircle, Globe } from 'lucide-react';

export default function QuickActions() {
  const actions = [
    {
      title: '新規投稿',
      description: '投稿を作成',
      icon: <MessageCircle size={20} />,
      link: '/posts',
      color: 'blue',
    },
    {
      title: 'アカウント追加',
      description: 'メインアカウントを追加',
      icon: <Users size={20} />,
      link: '/accounts/main',
      color: 'green',
    },
    {
      title: 'ルール作成',
      description: 'エンゲージメントルールを作成',
      icon: <Zap size={20} />,
      link: '/engagement',
      color: 'yellow',
    },
    {
      title: 'ループ作成',
      description: '自動投稿ループを作成',
      icon: <Repeat size={20} />,
      link: '/loops',
      color: 'purple',
    },
    {
      title: 'テンプレート追加',
      description: '投稿テンプレートを追加',
      icon: <FileText size={20} />,
      link: '/templates',
      color: 'orange',
    },
    {
      title: 'プロキシ登録',
      description: 'プロキシを登録',
      icon: <Globe size={20} />,
      link: '/proxies',
      color: 'blue',
    },
  ];

  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-white mb-4">クイックアクション</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.link}
            className="bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-all p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg ${colorClasses[action.color as keyof typeof colorClasses]} transition`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-white mb-1 group-hover:text-blue-400 transition">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-400">
                  {action.description}
                </p>
              </div>
              <Plus size={20} className="text-gray-500 group-hover:text-blue-400 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
