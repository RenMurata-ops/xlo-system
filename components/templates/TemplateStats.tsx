'use client';

import { X, BarChart3 } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

interface Template {
  id: string;
  template_name: string;
  template_type: 'post' | 'reply' | 'cta' | 'dm';
  content: string;
  variables: string[] | null;
  category: string | null;
  tags: string[] | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateStatsProps {
  templates: Template[];
  onClose: () => void;
}

const COLORS = {
  post: '#3B82F6',    // blue
  reply: '#10B981',   // green
  cta: '#A855F7',     // purple
  dm: '#FB923C',      // orange
};

const TEMPLATE_TYPES = [
  { key: 'post' as const, label: '投稿' },
  { key: 'reply' as const, label: 'リプライ' },
  { key: 'cta' as const, label: 'CTA' },
  { key: 'dm' as const, label: 'DM' },
];

export default function TemplateStats({ templates, onClose }: TemplateStatsProps) {
  // Usage by type
  const usageByType = TEMPLATE_TYPES.map(({ key, label }) => ({
    key,
    name: label,
    value: templates.filter(t => t.template_type === key).reduce((sum, t) => sum + t.usage_count, 0),
    count: templates.filter(t => t.template_type === key).length,
  }));

  // Top 10 most used templates
  const topTemplates = [...templates]
    .sort((a, b) => b.usage_count - a.usage_count)
    .slice(0, 10)
    .map(t => ({
      name: t.template_name.length > 20 ? t.template_name.substring(0, 20) + '...' : t.template_name,
      usage: t.usage_count,
      type: t.template_type,
    }));

  // Active vs Inactive
  const statusData = [
    {
      name: 'アクティブ',
      value: templates.filter(t => t.is_active).length,
      usage: templates.filter(t => t.is_active).reduce((sum, t) => sum + (t.usage_count || 0), 0),
    },
    {
      name: '非アクティブ',
      value: templates.filter(t => !t.is_active).length,
      usage: templates.filter(t => !t.is_active).reduce((sum, t) => sum + (t.usage_count || 0), 0),
    },
  ];

  const totalUsage = templates.reduce((sum, t) => sum + (t.usage_count || 0), 0);
  const avgUsage = templates.length > 0 ? (totalUsage / templates.length).toFixed(1) : '0';
  const mostUsedTemplate = templates.reduce((max, t) => t.usage_count > max.usage_count ? t : max, templates[0] || { usage_count: 0, template_name: 'N/A' });

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <BarChart3 size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">使用統計</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-8">
          {/* Summary Cards */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-gradient-to-br from-blue-50 to-blue-100 p-4 rounded-lg border border-blue-200">
              <div className="text-sm text-blue-700 mb-1">総使用回数</div>
              <div className="text-3xl font-bold text-blue-900">{totalUsage.toLocaleString()}</div>
            </div>
            <div className="bg-gradient-to-br from-green-50 to-green-100 p-4 rounded-lg border border-green-200">
              <div className="text-sm text-green-700 mb-1">平均使用回数</div>
              <div className="text-3xl font-bold text-green-900">{avgUsage}</div>
            </div>
            <div className="bg-gradient-to-br from-purple-50 to-purple-100 p-4 rounded-lg border border-purple-200">
              <div className="text-sm text-purple-700 mb-1">総テンプレート数</div>
              <div className="text-3xl font-bold text-purple-900">{templates.length}</div>
            </div>
            <div className="bg-gradient-to-br from-orange-50 to-orange-100 p-4 rounded-lg border border-orange-200">
              <div className="text-sm text-orange-700 mb-1">アクティブ</div>
              <div className="text-3xl font-bold text-orange-900">
                {templates.filter(t => t.is_active).length}
              </div>
            </div>
          </div>

          {/* Most Used Template */}
          {mostUsedTemplate && mostUsedTemplate.template_name !== 'N/A' && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-sm text-yellow-700 mb-1">最も使用されているテンプレート</div>
                  <div className="text-xl font-bold text-yellow-900">{mostUsedTemplate.template_name}</div>
                </div>
                <div className="text-right">
                  <div className="text-sm text-yellow-700 mb-1">使用回数</div>
                  <div className="text-3xl font-bold text-yellow-900">
                    {(mostUsedTemplate.usage_count || 0).toLocaleString()}
                  </div>
                </div>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Usage by Type - Pie Chart */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">タイプ別使用回数</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={usageByType}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value, percent }) => `${name}: ${value} (${percent ? (percent * 100).toFixed(0) : 0}%)`}
                    outerRadius={80}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {usageByType.map((entry) => (
                      <Cell key={entry.key} fill={COLORS[entry.key]} />
                    ))}
                  </Pie>
                  <Tooltip
                    formatter={(value: number, name: string, props: any) => [
                      `${value.toLocaleString()}回 (${props.payload.count}テンプレート)`,
                      name
                    ]}
                  />
                  <Legend />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Active vs Inactive */}
            <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">ステータス別統計</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={statusData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis yAxisId="left" orientation="left" stroke="#8884d8" />
                  <YAxis yAxisId="right" orientation="right" stroke="#82ca9d" />
                  <Tooltip />
                  <Legend />
                  <Bar yAxisId="left" dataKey="value" fill="#8884d8" name="テンプレート数" />
                  <Bar yAxisId="right" dataKey="usage" fill="#82ca9d" name="使用回数" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top 10 Templates */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">最も使用されているテンプレート Top 10</h3>
            <ResponsiveContainer width="100%" height={400}>
              <BarChart data={topTemplates} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={150} />
                <Tooltip
                  formatter={(value: number) => [`${value.toLocaleString()}回`, '使用回数']}
                />
                <Legend />
                <Bar
                  dataKey="usage"
                  fill="#8884d8"
                  name="使用回数"
                  radius={[0, 8, 8, 0]}
                >
                  {topTemplates.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={COLORS[entry.type as keyof typeof COLORS]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>

          {/* Type Breakdown Table */}
          <div className="bg-gray-50 rounded-lg p-6 border border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">タイプ別詳細</h3>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-100">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      タイプ
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      テンプレート数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      総使用回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      平均使用回数
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      アクティブ数
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {usageByType.map((type) => {
                    const typeKey = type.key;
                    const typeTemplates = templates.filter(t => t.template_type === typeKey);
                    const avgTypeUsage = type.count > 0 ? (type.value / type.count).toFixed(1) : '0';
                    const activeCount = typeTemplates.filter(t => t.is_active).length;

                    return (
                      <tr key={typeKey}>
                        <td className="px-6 py-4 whitespace-nowrap">
                          <span className={`px-2 py-1 rounded text-sm font-medium`} style={{ backgroundColor: COLORS[typeKey] + '20', color: COLORS[typeKey] }}>
                            {type.name}
                          </span>
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {type.count}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900 font-semibold">
                          {type.value.toLocaleString()}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {avgTypeUsage}
                        </td>
                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                          {activeCount} / {type.count}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center justify-end pt-4">
            <button
              onClick={onClose}
              className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
