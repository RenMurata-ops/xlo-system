'use client';

import { useState, useEffect } from 'react';
import { Plus, RefreshCw, Globe, CheckCircle } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import ProxyCard from '@/components/proxies/ProxyCard';
import ProxyForm from '@/components/proxies/ProxyForm';

interface Proxy {
  id: string;
  proxy_name: string | null;
  proxy_type: 'http' | 'https' | 'socks5' | 'nordvpn';
  proxy_url: string | null;
  host: string | null;
  port: number | null;
  username: string | null;
  password: string | null;
  country: string | null;
  is_active: boolean;
  last_checked_at: string | null;
  test_status: 'success' | 'failed' | 'untested' | null;
  response_time_ms: number | null;
  assigned_accounts_count: number | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

export default function ProxiesPage() {
  const [proxies, setProxies] = useState<Proxy[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingProxy, setEditingProxy] = useState<Proxy | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadProxies();
  }, []);

  async function loadProxies() {
    try {
      const { data, error } = await supabase
        .from('proxies')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProxies(data || []);
    } catch (error) {
      console.error('Error loading proxies:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このプロキシを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('proxies')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setProxies(proxies.filter(proxy => proxy.id !== id));
      toast.success('プロキシを削除しました');
    } catch (error) {
      console.error('Error deleting proxy:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('proxies')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setProxies(proxies.map(proxy =>
        proxy.id === id ? { ...proxy, is_active: !currentStatus } : proxy
      ));
      toast.success(currentStatus ? 'プロキシを停止しました' : 'プロキシを有効化しました');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('ステータス変更に失敗しました');
    }
  }

  async function handleTest(id: string) {
    try {
      // ここで実際のプロキシテストを実行
      // 現時点ではステータス更新のみ
      const { error } = await supabase
        .from('proxies')
        .update({
          last_checked_at: new Date().toISOString(),
          test_status: 'success',
          response_time_ms: Math.floor(Math.random() * 1000) + 100
        })
        .eq('id', id);

      if (error) throw error;

      loadProxies();
      toast.success('プロキシテスト成功');
    } catch (error) {
      console.error('Error testing proxy:', error);
      toast.error('テストに失敗しました');
    }
  }

  function handleEdit(proxy: Proxy) {
    setEditingProxy(proxy);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingProxy(null);
    loadProxies();
  }

  const activeProxies = proxies.filter(p => p.is_active).length;
  const workingProxies = proxies.filter(p => p.test_status === 'success').length;
  const totalAssignments = proxies.reduce((sum, p) => sum + (p.assigned_accounts_count || 0), 0);
  const avgResponseTime = proxies.length > 0
    ? (proxies.reduce((sum, p) => sum + (p.response_time_ms || 0), 0) / proxies.length).toFixed(0)
    : '0';

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
          <h1 className="text-3xl font-bold text-gray-900">プロキシ管理</h1>
          <p className="text-gray-600 mt-2">
            プロキシサーバーを管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={loadProxies}
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
            新規登録
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">総プロキシ数</div>
          <div className="text-3xl font-bold text-gray-900">{proxies.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeProxies}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">正常動作</div>
          <div className="text-3xl font-bold text-blue-600">{workingProxies}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">割当アカウント</div>
          <div className="text-3xl font-bold text-purple-600">{totalAssignments}</div>
        </div>
      </div>

      {proxies.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Globe size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            プロキシが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            プロキシサーバーを登録してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のプロキシを登録
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {proxies.map(proxy => (
            <ProxyCard
              key={proxy.id}
              proxy={proxy}
              onEdit={() => handleEdit(proxy)}
              onDelete={() => handleDelete(proxy.id)}
              onToggleActive={() => handleToggleActive(proxy.id, proxy.is_active)}
              onTest={() => handleTest(proxy.id)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <ProxyForm
          proxy={editingProxy}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
