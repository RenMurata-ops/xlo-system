'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';
import TwitterAppForm from '@/components/twitter-apps/TwitterAppForm';
import TwitterAppCard from '@/components/twitter-apps/TwitterAppCard';

interface TwitterApp {
  id: string;
  app_name: string;
  api_key: string;
  api_secret: string;
  bearer_token: string | null;
  client_id: string | null;
  client_secret: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function TwitterAppsPage() {
  const [apps, setApps] = useState<TwitterApp[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editingApp, setEditingApp] = useState<TwitterApp | null>(null);
  const supabase = createClient();

  useEffect(() => {
    loadApps();
  }, []);

  async function loadApps() {
    try {
      const { data, error } = await supabase
        .from('twitter_apps')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setApps(data || []);
    } catch (error) {
      console.error('Error loading apps:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このTwitterアプリを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('twitter_apps')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setApps(apps.filter(app => app.id !== id));
      toast.success('Twitterアプリを削除しました');
    } catch (error) {
      console.error('Error deleting app:', error);
      toast.error('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('twitter_apps')
        .update({ is_active: !currentStatus })
        .eq('id', id);

      if (error) throw error;

      setApps(apps.map(app =>
        app.id === id ? { ...app, is_active: !currentStatus } : app
      ));
      toast.success(currentStatus ? 'アプリを停止しました' : 'アプリを有効化しました');
    } catch (error) {
      console.error('Error toggling status:', error);
      toast.error('ステータス変更に失敗しました');
    }
  }

  function handleEdit(app: TwitterApp) {
    setEditingApp(app);
    setShowForm(true);
  }

  function handleFormClose() {
    setShowForm(false);
    setEditingApp(null);
    loadApps();
  }

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
          <h1 className="text-3xl font-bold text-white">X Apps 管理</h1>
          <p className="text-gray-400 mt-2">
            X (Twitter) アカウントを操作するために必要なX Appの認証情報を登録します
          </p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
        >
          <Plus size={20} />
          X Appを追加
        </button>
      </div>

      {/* Setup Instructions */}
      <div className="bg-blue-900/20 border border-blue-700 rounded-lg p-6 mb-8">
        <h2 className="text-lg font-semibold text-blue-200 mb-3">X App登録の手順</h2>
        <ol className="list-decimal list-inside space-y-2 text-sm text-blue-100">
          <li>
            <a
              href="https://developer.twitter.com/en/portal/dashboard"
              target="_blank"
              rel="noopener noreferrer"
              className="text-blue-400 hover:text-blue-300 underline"
            >
              X Developer Portal
            </a>
            でアプリを作成
          </li>
          <li>アプリ設定でOAuth 2.0を有効化し、Callback URLを設定</li>
          <li>API Key、API Secret、Client ID、Client Secretを取得</li>
          <li>このページで「X Appを追加」ボタンをクリックし、取得した情報を入力</li>
          <li>登録後、メインアカウント・スパムアカウント管理ページでOAuth認証を実行</li>
        </ol>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">登録アプリ数</div>
          <div className="text-3xl font-bold text-gray-900">{apps.length}</div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">
            {apps.filter(app => app.is_active).length}
          </div>
        </div>
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="text-sm text-gray-600 mb-1">非アクティブ</div>
          <div className="text-3xl font-bold text-gray-400">
            {apps.filter(app => !app.is_active).length}
          </div>
        </div>
      </div>

      {apps.length === 0 ? (
        <div className="bg-gray-900 border border-gray-800 rounded-lg shadow p-12 text-center">
          <Settings size={64} className="mx-auto text-gray-600 mb-4" />
          <h3 className="text-xl font-semibold text-white mb-2">
            X Appが登録されていません
          </h3>
          <p className="text-gray-400 mb-6">
            上記の手順に従ってX Developer PortalでアプリをまずX Appを登録してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition font-semibold"
          >
            <Plus size={20} />
            X Appを追加
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {apps.map(app => (
            <TwitterAppCard
              key={app.id}
              app={app}
              onEdit={() => handleEdit(app)}
              onDelete={() => handleDelete(app.id)}
              onToggleActive={() => handleToggleActive(app.id, app.is_active)}
            />
          ))}
        </div>
      )}

      {showForm && (
        <TwitterAppForm
          app={editingApp}
          onClose={handleFormClose}
        />
      )}
    </div>
  );
}
