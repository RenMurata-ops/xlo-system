'use client';

import { useEffect, useState } from 'react';
import { X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface Rule {
  id: string;
  account_token_id: string;
  account_type: 'main' | 'spam' | 'follow';
  template_id: string;
  delay_slot_hours: number;
  daily_limit: number | null;
  status: 'active' | 'paused';
}

interface TokenOption {
  id: string;
  x_username: string;
  account_type: 'main' | 'spam' | 'follow';
}

interface TemplateOption {
  id: string;
  template_name: string;
}

interface Props {
  rule?: Rule | null;
  onClose: () => void;
}

export default function DMSendRuleForm({ rule, onClose }: Props) {
  const [formData, setFormData] = useState({
    account_token_id: '',
    account_type: 'main' as 'main' | 'spam' | 'follow',
    template_id: '',
    delay_slot_hours: 0,
    daily_limit: '',
    status: 'active' as 'active' | 'paused',
  });
  const [tokens, setTokens] = useState<TokenOption[]>([]);
  const [templates, setTemplates] = useState<TemplateOption[]>([]);
  const [loading, setLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadTokens();
    loadTemplates();
  }, []);

  useEffect(() => {
    if (rule) {
      setFormData({
        account_token_id: rule.account_token_id,
        account_type: rule.account_type,
        template_id: rule.template_id,
        delay_slot_hours: rule.delay_slot_hours,
        daily_limit: rule.daily_limit?.toString() || '',
        status: rule.status,
      });
    }
  }, [rule]);

  async function loadTokens() {
    try {
      const { data, error } = await supabase
        .from('account_tokens')
        .select('id, x_username, account_type')
        .eq('is_active', true);
      if (error) throw error;
      setTokens((data as TokenOption[]) || []);
    } catch (error) {
      console.error(error);
      toast.error('アカウント取得に失敗しました');
    }
  }

  async function loadTemplates() {
    try {
      const { data, error } = await supabase
        .from('templates')
        .select('id, template_name')
        .eq('template_type', 'dm')
        .eq('is_active', true)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setTemplates((data as TemplateOption[]) || []);
    } catch (error) {
      console.error(error);
      toast.error('テンプレート取得に失敗しました');
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('ログインが必要です');

      const payload = {
        user_id: user.id,
        account_token_id: formData.account_token_id,
        account_type: formData.account_type,
        template_id: formData.template_id,
        delay_slot_hours: Number(formData.delay_slot_hours),
        daily_limit: formData.daily_limit === '' ? null : Number(formData.daily_limit),
        status: formData.status,
      };

      if (rule) {
        const { error } = await supabase.from('dm_send_rules').update(payload).eq('id', rule.id);
        if (error) throw error;
        toast.success('DMルールを更新しました');
      } else {
        const { error } = await supabase.from('dm_send_rules').insert([payload]);
        if (error) throw error;
        toast.success('DMルールを作成しました');
      }
      onClose();
    } catch (error: any) {
      console.error(error);
      toast.error(error.message || '保存に失敗しました');
    } finally {
      setLoading(false);
    }
  }

  const slots = Array.from({ length: 25 }).map((_, idx) => ({
    value: idx,
    label: idx === 0 ? '即時' : `${idx}時間後`,
  }));

  return (
    <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-xl font-bold text-gray-900">
            {rule ? 'DMルールを編集' : 'DMルールを作成'}
          </h2>
          <button onClick={onClose} className="p-2 text-gray-400 hover:text-gray-600">
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">送信元アカウント *</label>
            <select
              required
              value={formData.account_token_id}
              onChange={(e) => {
                const token = tokens.find(t => t.id === e.target.value);
                setFormData({
                  ...formData,
                  account_token_id: e.target.value,
                  account_type: token?.account_type || 'main',
                });
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {tokens.map(t => (
                <option key={t.id} value={t.id}>
                  @{t.x_username} ({t.account_type})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">DMテンプレート *</label>
            <select
              required
              value={formData.template_id}
              onChange={(e) => setFormData({ ...formData, template_id: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">選択してください</option>
              {templates.map(t => (
                <option key={t.id} value={t.id}>{t.template_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">遅延スロット *</label>
            <select
              required
              value={formData.delay_slot_hours}
              onChange={(e) => setFormData({ ...formData, delay_slot_hours: Number(e.target.value) })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              {slots.map(s => (
                <option key={s.value} value={s.value}>{s.label}</option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">0は即時送信、1〜24は指定時間後に送信</p>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">1日上限 (任意)</label>
            <input
              type="number"
              min={0}
              placeholder="例: 50"
              value={formData.daily_limit}
              onChange={(e) => setFormData({ ...formData, daily_limit: e.target.value })}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex items-center gap-3">
            <input
              type="checkbox"
              id="status"
              checked={formData.status === 'active'}
              onChange={(e) => setFormData({ ...formData, status: e.target.checked ? 'active' : 'paused' })}
              className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
            />
            <label htmlFor="status" className="text-sm text-gray-700">有効化する</label>
          </div>

          <div className="flex justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={loading}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition disabled:opacity-50"
            >
              {loading ? '保存中...' : rule ? '更新' : '作成'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
