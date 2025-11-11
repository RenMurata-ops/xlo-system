'use client';

import { Edit2, Trash2, CheckCircle, XCircle, Eye, FileText, MessageCircle, Megaphone } from 'lucide-react';

interface Template {
  id: string;
  template_name: string;
  template_type: 'post' | 'reply' | 'cta';
  content: string;
  variables: string[] | null;
  category: string | null;
  tags: string[] | null;
  usage_count: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

interface TemplateCardProps {
  template: Template;
  onEdit: () => void;
  onDelete: () => void;
  onToggleActive: () => void;
  onPreview: () => void;
}

export default function TemplateCard({
  template,
  onEdit,
  onDelete,
  onToggleActive,
  onPreview
}: TemplateCardProps) {
  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'post': return <FileText size={16} />;
      case 'reply': return <MessageCircle size={16} />;
      case 'cta': return <Megaphone size={16} />;
      default: return null;
    }
  };

  const getTypeLabel = (type: string) => {
    switch (type) {
      case 'post': return '投稿';
      case 'reply': return 'リプライ';
      case 'cta': return 'CTA';
      default: return type;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'post': return 'bg-blue-100 text-blue-800';
      case 'reply': return 'bg-green-100 text-green-800';
      case 'cta': return 'bg-purple-100 text-purple-800';
      default: return 'bg-gray-100 text-gray-800';
    }
  };

  return (
    <div className={`bg-white rounded-lg shadow hover:shadow-lg transition-shadow ${
      !template.is_active ? 'opacity-60' : ''
    }`}>
      <div className="p-6 border-b border-gray-200">
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {template.template_name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getTypeColor(template.template_type)}`}>
                {getTypeIcon(template.template_type)}
                {getTypeLabel(template.template_type)}
              </span>
              <span className={`px-2 py-1 rounded text-xs font-medium ${
                template.is_active
                  ? 'bg-green-100 text-green-800'
                  : 'bg-gray-100 text-gray-600'
              }`}>
                {template.is_active ? 'アクティブ' : '非アクティブ'}
              </span>
              {template.category && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  {template.category}
                </span>
              )}
            </div>
          </div>
          {template.is_active ? (
            <CheckCircle size={20} className="text-green-500" />
          ) : (
            <XCircle size={20} className="text-gray-400" />
          )}
        </div>

        <div className="mt-3 p-3 bg-gray-50 rounded text-sm text-gray-700 line-clamp-3 whitespace-pre-wrap">
          {template.content}
        </div>
      </div>

      <div className="p-6 space-y-3">
        {template.variables && template.variables.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">変数</div>
            <div className="flex items-center gap-1 flex-wrap">
              {template.variables.map((variable, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-yellow-50 text-yellow-700 font-mono"
                >
                  {variable}
                </span>
              ))}
            </div>
          </div>
        )}

        {template.tags && template.tags.length > 0 && (
          <div>
            <div className="text-xs text-gray-500 mb-1">タグ</div>
            <div className="flex items-center gap-1 flex-wrap">
              {template.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>
        )}

        <div className="pt-2 border-t border-gray-100 flex items-center justify-between text-sm">
          <span className="text-gray-600">使用回数</span>
          <span className="font-semibold text-gray-900">
            {template.usage_count.toLocaleString()}回
          </span>
        </div>
      </div>

      <div className="p-4 bg-gray-50 rounded-b-lg flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <button
            onClick={onToggleActive}
            className={`px-3 py-2 text-sm rounded transition ${
              template.is_active
                ? 'bg-gray-200 text-gray-700 hover:bg-gray-300'
                : 'bg-green-100 text-green-700 hover:bg-green-200'
            }`}
          >
            {template.is_active ? '無効化' : '有効化'}
          </button>

          <button
            onClick={onPreview}
            className="p-2 text-purple-600 hover:bg-purple-50 rounded transition"
            aria-label="プレビュー"
          >
            <Eye size={16} />
          </button>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={onEdit}
            className="p-2 text-blue-600 hover:bg-blue-50 rounded transition"
            aria-label="編集"
          >
            <Edit2 size={16} />
          </button>

          <button
            onClick={onDelete}
            className="p-2 text-red-600 hover:bg-red-50 rounded transition"
            aria-label="削除"
          >
            <Trash2 size={16} />
          </button>
        </div>
      </div>

      <div className="px-6 py-3 bg-gray-50 border-t border-gray-200 text-xs text-gray-500">
        作成日: {new Date(template.created_at).toLocaleDateString('ja-JP')}
      </div>
    </div>
  );
}
