'use client';

import { useState, useEffect } from 'react';
import { X, FileText, MessageCircle, Megaphone, Eye } from 'lucide-react';

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

interface TemplatePreviewProps {
  template: Template;
  onClose: () => void;
}

export default function TemplatePreview({ template, onClose }: TemplatePreviewProps) {
  const [variableValues, setVariableValues] = useState<Record<string, string>>({});
  const [previewContent, setPreviewContent] = useState('');

  useEffect(() => {
    if (template.variables) {
      const initialValues: Record<string, string> = {};
      template.variables.forEach(variable => {
        initialValues[variable] = '';
      });
      setVariableValues(initialValues);
    }
  }, [template]);

  useEffect(() => {
    let content = template.content;

    if (template.variables) {
      template.variables.forEach(variable => {
        const value = variableValues[variable] || `{{${variable}}}`;
        const regex = new RegExp(`\\{\\{${variable}\\}\\}`, 'g');
        content = content.replace(regex, value);
      });
    }

    setPreviewContent(content);
  }, [template.content, template.variables, variableValues]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'post': return <FileText size={20} />;
      case 'reply': return <MessageCircle size={20} />;
      case 'cta': return <Megaphone size={20} />;
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

  const charCount = previewContent.length;
  const maxChars = 280;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-3xl w-full max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <div className="flex items-center gap-3">
            <Eye size={24} className="text-blue-600" />
            <h2 className="text-2xl font-bold text-gray-900">テンプレートプレビュー</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 transition"
          >
            <X size={24} />
          </button>
        </div>

        <div className="p-6 space-y-6">
          <div>
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              {template.template_name}
            </h3>
            <div className="flex items-center gap-2 flex-wrap">
              <span className={`px-2 py-1 rounded text-xs font-medium flex items-center gap-1 ${getTypeColor(template.template_type)}`}>
                {getTypeIcon(template.template_type)}
                {getTypeLabel(template.template_type)}
              </span>
              {template.category && (
                <span className="px-2 py-1 rounded text-xs font-medium bg-orange-100 text-orange-800">
                  {template.category}
                </span>
              )}
              {template.tags && template.tags.map((tag, idx) => (
                <span
                  key={idx}
                  className="px-2 py-1 text-xs rounded bg-blue-50 text-blue-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {template.variables && template.variables.length > 0 && (
            <div>
              <h4 className="text-sm font-semibold text-gray-900 mb-3">
                変数の値を入力してプレビューを確認
              </h4>
              <div className="space-y-3">
                {template.variables.map((variable) => (
                  <div key={variable}>
                    <label className="block text-sm font-medium text-gray-700 mb-1">
                      {variable}
                    </label>
                    <input
                      type="text"
                      value={variableValues[variable] || ''}
                      onChange={(e) => setVariableValues({
                        ...variableValues,
                        [variable]: e.target.value
                      })}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm"
                      placeholder={`${variable}の値を入力`}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-semibold text-gray-900">
                プレビュー
              </h4>
              <span className={`text-sm ${charCount > maxChars ? 'text-red-600 font-semibold' : 'text-gray-600'}`}>
                {charCount} / {maxChars}
              </span>
            </div>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="text-sm text-gray-900 whitespace-pre-wrap break-words">
                {previewContent || template.content}
              </div>
            </div>
            {charCount > maxChars && (
              <p className="text-xs text-red-600 mt-1">
                文字数制限を超えています
              </p>
            )}
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h4 className="text-sm font-semibold text-blue-900 mb-2">
              元のテンプレート
            </h4>
            <div className="text-sm text-blue-800 whitespace-pre-wrap break-words font-mono">
              {template.content}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-200">
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">使用回数</div>
              <div className="text-xl font-bold text-gray-900">{template.usage_count.toLocaleString()}</div>
            </div>
            <div className="bg-gray-50 p-3 rounded-lg">
              <div className="text-xs text-gray-600 mb-1">ステータス</div>
              <div className={`text-xl font-bold ${template.is_active ? 'text-green-600' : 'text-gray-400'}`}>
                {template.is_active ? 'アクティブ' : '非アクティブ'}
              </div>
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
