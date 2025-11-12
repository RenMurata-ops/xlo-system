'use client';

import { useState, useEffect } from 'react';
import { Plus, Settings } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import TwitterAppForm from '@/components/twitter-apps/TwitterAppForm';
import TwitterAppCard from '@/components/twitter-apps/TwitterAppCard';

interface TwitterApp {
  id: string;
  name: string;
  api_key: string;
  api_secret: string;
  access_token: string;
  access_token_secret: string;
  bearer_token: string | null;
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
    } catch (error) {
      console.error('Error deleting app:', error);
      alert('削除に失敗しました');
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
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータス変更に失敗しました');
    }
  }

  async function handleConnectOAuth() {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) {
        alert('ログインが必要です');
        return;
      }

      const response = await fetch(
        `${process.env.NEXT_PUBLIC_SUPABASE_URL}/functions/v1/twitter-oauth-start`,
        {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${session.access_token}`,
            'Content-Type': 'application/json',
          },
        }
      );

      if (!response.ok) {
        throw new Error('OAuth開始に失敗しました');
      }

      const { authUrl } = await response.json();
      window.location.href = authUrl;
    } catch (error) {
      console.error('OAuth error:', error);
      alert('OAuth接続に失敗しました');
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
          <h1 className="text-3xl font-bold text-white">Twitter Apps</h1>
          <p className="text-gray-400 mt-2">
            Twitterアプリケーションの認証情報を管理します
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={handleConnectOAuth}
            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition"
          >
            <Plus size={20} />
            OAuth2で接続
          </button>
          <button
            onClick={() => setShowForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            手動登録
          </button>
        </div>
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
        <div className="bg-white rounded-lg shadow p-12 text-center">
          <Settings size={64} className="mx-auto text-gray-300 mb-4" />
          <h3 className="text-xl font-semibold text-gray-900 mb-2">
            Twitterアプリが登録されていません
          </h3>
          <p className="text-gray-600 mb-6">
            まずはTwitter Developer Portalでアプリを作成し、認証情報を登録してください
          </p>
          <button
            onClick={() => setShowForm(true)}
            className="inline-flex items-center gap-2 px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition"
          >
            <Plus size={20} />
            最初のアプリを登録
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
