'use client';

import Link from 'next/link';
import { ArrowRight } from 'lucide-react';

interface StatsCardProps {
  title: string;
  value: number | string;
  subtitle?: string;
  icon: React.ReactNode;
  color: 'blue' | 'green' | 'purple' | 'orange' | 'yellow';
  link?: string;
}

export default function StatsCard({
  title,
  value,
  subtitle,
  icon,
  color,
  link
}: StatsCardProps) {
  const colorClasses = {
    blue: 'bg-blue-500/20 text-blue-400',
    green: 'bg-green-500/20 text-green-400',
    purple: 'bg-purple-500/20 text-purple-400',
    orange: 'bg-orange-500/20 text-orange-400',
    yellow: 'bg-yellow-500/20 text-yellow-400',
  };

  const Card = (
    <div className="bg-gray-800 border border-gray-700 rounded-lg hover:border-gray-600 transition-all p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-gray-400 mb-1">{title}</p>
          <p className="text-3xl font-bold text-white">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      {link && (
        <div className="flex items-center gap-1 text-sm text-blue-400 hover:text-blue-300 transition">
          <span>詳細を見る</span>
          <ArrowRight size={16} />
        </div>
      )}
    </div>
  );

  if (link) {
    return (
      <Link href={link}>
        {Card}
      </Link>
    );
  }

  return Card;
}
