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
    blue: 'bg-blue-600 hover:bg-blue-700',
    green: 'bg-green-600 hover:bg-green-700',
    purple: 'bg-purple-600 hover:bg-purple-700',
    orange: 'bg-orange-600 hover:bg-orange-700',
    yellow: 'bg-yellow-600 hover:bg-yellow-700',
  };

  return (
    <div>
      <h2 className="text-xl font-semibold text-gray-900 mb-4">クイックアクション</h2>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {actions.map((action, index) => (
          <Link
            key={index}
            href={action.link}
            className="bg-white rounded-lg shadow hover:shadow-lg transition-all p-6 group"
          >
            <div className="flex items-start gap-4">
              <div className={`p-3 rounded-lg text-white ${colorClasses[action.color as keyof typeof colorClasses]} transition`}>
                {action.icon}
              </div>
              <div className="flex-1">
                <h3 className="font-semibold text-gray-900 mb-1 group-hover:text-blue-600 transition">
                  {action.title}
                </h3>
                <p className="text-sm text-gray-600">
                  {action.description}
                </p>
              </div>
              <Plus size={20} className="text-gray-400 group-hover:text-blue-600 transition" />
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
