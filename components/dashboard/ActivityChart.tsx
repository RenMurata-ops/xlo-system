'use client';

import { TrendingUp } from 'lucide-react';

interface ActivityData {
  date: string;
  posts: number;
  engagements: number;
}

interface ActivityChartProps {
  data: ActivityData[];
}

export default function ActivityChart({ data }: ActivityChartProps) {
  const maxValue = Math.max(
    ...data.map(d => Math.max(d.posts, d.engagements))
  );

  return (
    <div className="bg-white rounded-lg shadow p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-gray-900">アクティビティ</h3>
          <p className="text-sm text-gray-600">過去7日間の活動状況</p>
        </div>
        <TrendingUp size={24} className="text-blue-600" />
      </div>

      <div className="space-y-4">
        {data.map((item, index) => (
          <div key={index} className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">{item.date}</span>
              <div className="flex items-center gap-4">
                <span className="text-blue-600">投稿: {item.posts}</span>
                <span className="text-green-600">エンゲージメント: {item.engagements}</span>
              </div>
            </div>
            <div className="flex gap-2">
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-blue-600 h-full rounded-full transition-all"
                  style={{ width: `${(item.posts / maxValue) * 100}%` }}
                />
              </div>
              <div className="flex-1 bg-gray-100 rounded-full h-2 overflow-hidden">
                <div
                  className="bg-green-600 h-full rounded-full transition-all"
                  style={{ width: `${(item.engagements / maxValue) * 100}%` }}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
