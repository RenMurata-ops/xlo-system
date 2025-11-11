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
    blue: 'bg-blue-50 text-blue-600',
    green: 'bg-green-50 text-green-600',
    purple: 'bg-purple-50 text-purple-600',
    orange: 'bg-orange-50 text-orange-600',
    yellow: 'bg-yellow-50 text-yellow-600',
  };

  const Card = (
    <div className="bg-white rounded-lg shadow hover:shadow-lg transition-shadow p-6">
      <div className="flex items-start justify-between mb-4">
        <div className="flex-1">
          <p className="text-sm text-gray-600 mb-1">{title}</p>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
          {subtitle && (
            <p className="text-xs text-gray-500 mt-1">{subtitle}</p>
          )}
        </div>
        <div className={`p-3 rounded-lg ${colorClasses[color]}`}>
          {icon}
        </div>
      </div>
      {link && (
        <div className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-700 transition">
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
