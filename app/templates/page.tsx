'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, FileText, Filter } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import TemplateCard from '@/components/templates/TemplateCard';
import TemplateForm from '@/components/templates/TemplateForm';
import TemplatePreview from '@/components/templates/TemplatePreview';

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

export default function TemplatesPage() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState<Template | null>(null);
  const [showPreview, setShowPreview] = useState(false);
  const [previewTemplate, setPreviewTemplate] = useState<Template | null>(null);
  const [filterType, setFilterType] = useState<string>('all');
  const supabase = createClient();

  useEffect(() => {
    loadTemplates();
  }, []);

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setTemplates(data || []);
    } catch (error) {
      console.error('Error loading templates:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このテンプレートを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('templates')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setTemplates(templates.filter(tmpl => tmpl.id !== id));
      toast.success('テンプレートを削除しました');
    } catch (error) {
      console.error('Error deleting template:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('templates')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setTemplates(templates.map(tmpl =>
        tmpl.id === id ? { ...tmpl, is_active: !currentStatus } : tmpl
      ));
      toast.success(currentStatus ? 'テンプレートを停止しました' : 'テンプレートを有効化しました');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('ステータス変更に失敗しました');
    }
  }

  function handleEdit(template: Template) {
    setEditingTemplate(template);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingTemplate(null);
    loadTemplates();
  }

  function handlePreview(template: Template) {
    setPreviewTemplate(template);
    setShowPreview(true);
  }

  const types = [
    { value: 'all', label: 'すべて' },
    { value: 'post', label: '投稿' },
    { value: 'reply', label: 'リプライ' },
    { value: 'cta', label: 'CTA' },
  ];

  const filteredTemplates = filterType === 'all'
    ? templates
    : templates.filter(tmpl => tmpl.template_type === filterType);

  const postTemplates = templates.filter(t => t.template_type === 'post').length;
  const replyTemplates = templates.filter(t => t.template_type === 'reply').length;
  const ctaTemplates = templates.filter(t => t.template_type === 'cta').length;
  const totalUsage = templates.reduce((sum, t) => sum + t.usage_count, 0);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">テンプレート管理</h1>
          <p className="text-gray-600 mt-2">
            投稿・リプライ・CTAのテンプレートを管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadTemplates}
            className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
          >
            <RefreshCw size={20} />
            更新
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            新規作成
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">投稿テンプレート</div>
          <div className="text-3xl font-bold text-blue-600">{postTemplates}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">リプライテンプレート</div>
          <div className="text-3xl font-bold text-green-600">{replyTemplates}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">CTAテンプレート</div>
          <div className="text-3xl font-bold text-purple-600">{ctaTemplates}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総使用回数</div>
          <div className="text-3xl font-bold text-orange-600">{totalUsage.toLocaleString()}</div>
        </div>
      </div>

      <div className="mb-6 flex items-center gap-2">
        <Filter size={20} className="text-gray-600" />
        <div className="flex items-center gap-2">
          {types.map(type => (
            <button
              key={type.value}
              onClick={() => setFilterType(type.value)}
              className={`px-4 py-2 rounded-lg text-sm font-medium transition ${
                filterType === type.value
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
              }`}
            >
              {type.label}
            </button>
          ))}
        </div>
      </div>

      {filteredTemplates.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <FileText size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            {filterType === 'all' ? 'テンプレートがありません' : `${types.find(t => t.value === filterType)?.label}テンプレートがありません`}
          </h3>
          <p className="text-gray-600 mb-6">
            新しいテンプレートを作成してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のテンプレートを作成
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {filteredTemplates.map(template => (
            <TemplateCard
              key={template.id}
              template={template}
              onEdit={() => handleEdit(template)}
              onDelete={() => handleDelete(template.id)}
              onToggleActive={() => handleToggleActive(template.id, template.is_active)}
              onPreview={() => handlePreview(template)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TemplateForm
          template={editingTemplate}
          onClose={handleFormClose}
        />
      )}

      {showPreview && previewTemplate && (
        <TemplatePreview
          template={previewTemplate}
          onClose={() => setShowPreview(false)}
        />
      )}
    </div>
  );
}
