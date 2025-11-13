'use client';

import { useState, useEffect } from 'react';
import { Settings, User, Shield, Database, Link as LinkIcon, Info } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';

export default function SettingsPage() {
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState<any>(null);
  const [stats, setStats] = useState({
    twitterApps: 0,
    activeTwitterApps: 0,
    mainAccounts: 0,
    activeAccounts: 0,
    posts: 0,
    loops: 0,
    engagementRules: 0,
  });
  const supabase = createClient();

  useEffect(() => {
    loadUserAndStats();
  }, []);

  async function loadUserAndStats() {
    try {
      // Get user
      const { data: { user: currentUser } } = await supabase.auth.getUser();
      setUser(currentUser);

      if (!currentUser) {
        setLoading(false);
        return;
      }

      // Load statistics
      const [appsResult, accountsResult, postsResult, loopsResult, rulesResult] = await Promise.all([
        supabase.from('twitter_apps').select('id, is_active', { count: 'exact' }).eq('user_id', currentUser.id),
        supabase.from('main_accounts').select('id, is_active', { count: 'exact' }).eq('user_id', currentUser.id),
        supabase.from('posts').select('id', { count: 'exact' }).eq('user_id', currentUser.id),
        supabase.from('loops').select('id', { count: 'exact' }).eq('user_id', currentUser.id),
        supabase.from('auto_engagement_rules').select('id', { count: 'exact' }).eq('user_id', currentUser.id),
      ]);

      setStats({
        twitterApps: appsResult.count || 0,
        activeTwitterApps: appsResult.data?.filter(a => a.is_active).length || 0,
        mainAccounts: accountsResult.count || 0,
        activeAccounts: accountsResult.data?.filter(a => a.is_active).length || 0,
        posts: postsResult.count || 0,
        loops: loopsResult.count || 0,
        engagementRules: rulesResult.count || 0,
      });
    } catch (error) {
      console.error('Error loading data:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleSignOut() {
    try {
      await supabase.auth.signOut();
      window.location.href = '/';
    } catch (error) {
      console.error('Sign out error:', error);
      alert('サインアウトに失敗しました');
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8 max-w-6xl">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-white flex items-center gap-2">
          <Settings className="h-8 w-8" />
          設定
        </h1>
        <p className="text-gray-400 mt-2">
          アカウント設定とシステム情報
        </p>
      </div>

      <div className="grid gap-6">
        {/* User Profile */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <User className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold">ユーザープロフィール</h2>
          </div>
          <div className="space-y-3">
            <div>
              <div className="text-sm text-muted-foreground">メールアドレス</div>
              <div className="text-lg font-medium">{user?.email || '未設定'}</div>
            </div>
            <div>
              <div className="text-sm text-muted-foreground">ユーザーID</div>
              <div className="text-sm font-mono text-muted-foreground">{user?.id || '未設定'}</div>
            </div>
            <div className="pt-4">
              <Button onClick={handleSignOut} variant="outline">
                サインアウト
              </Button>
            </div>
          </div>
        </Card>

        {/* System Statistics */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Database className="h-6 w-6 text-purple-600" />
            <h2 className="text-xl font-semibold">システム統計</h2>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="p-4 bg-blue-50 rounded-lg">
              <div className="text-sm text-blue-600 mb-1">Twitter Apps</div>
              <div className="text-2xl font-bold text-blue-700">
                {stats.activeTwitterApps}/{stats.twitterApps}
              </div>
              <div className="text-xs text-blue-600 mt-1">アクティブ/総数</div>
            </div>
            <div className="p-4 bg-green-50 rounded-lg">
              <div className="text-sm text-green-600 mb-1">アカウント</div>
              <div className="text-2xl font-bold text-green-700">
                {stats.activeAccounts}/{stats.mainAccounts}
              </div>
              <div className="text-xs text-green-600 mt-1">アクティブ/総数</div>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <div className="text-sm text-purple-600 mb-1">投稿</div>
              <div className="text-2xl font-bold text-purple-700">{stats.posts}</div>
              <div className="text-xs text-purple-600 mt-1">合計</div>
            </div>
            <div className="p-4 bg-orange-50 rounded-lg">
              <div className="text-sm text-orange-600 mb-1">ループ</div>
              <div className="text-2xl font-bold text-orange-700">{stats.loops}</div>
              <div className="text-xs text-orange-600 mt-1">合計</div>
            </div>
          </div>
          <div className="mt-4 p-4 bg-gray-50 rounded-lg">
            <div className="text-sm text-gray-600 mb-1">エンゲージメントルール</div>
            <div className="text-2xl font-bold text-gray-700">{stats.engagementRules}</div>
          </div>
        </Card>

        {/* Integration Info */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <LinkIcon className="h-6 w-6 text-green-600" />
            <h2 className="text-xl font-semibold">Twitter App連携</h2>
          </div>
          <div className="space-y-3">
            <div className="p-4 bg-green-50 border border-green-200 rounded-lg">
              <p className="text-sm text-green-800">
                <strong>✓ マルチテナント対応：</strong> 各ユーザーが独自のTwitter Appを登録し、管理できます。
              </p>
            </div>
            <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <p className="text-sm text-blue-800">
                <strong>🔐 OAuth 2.0認証：</strong> すべてのアカウントはTwitter AppsページでOAuth 2.0 PKCEフローを使用して認証されます。
              </p>
            </div>
            <div className="p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <p className="text-sm text-purple-800">
                <strong>🚀 実際のX platform：</strong> すべての投稿、エンゲージメント、ループ実行は実際のX（Twitter）プラットフォーム上で動作します。
              </p>
            </div>
          </div>
        </Card>

        {/* System Information */}
        <Card className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <Info className="h-6 w-6 text-gray-600" />
            <h2 className="text-xl font-semibold">システム情報</h2>
          </div>
          <div className="space-y-2 text-sm">
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-muted-foreground">アプリケーション</span>
              <span className="font-medium">XLO System</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-muted-foreground">フレームワーク</span>
              <span className="font-medium">Next.js 15 + Supabase</span>
            </div>
            <div className="flex justify-between py-2 border-b border-gray-200">
              <span className="text-muted-foreground">認証</span>
              <span className="font-medium">Supabase Auth + Twitter OAuth 2.0</span>
            </div>
            <div className="flex justify-between py-2">
              <span className="text-muted-foreground">デプロイメント</span>
              <span className="font-medium">Vercel + Supabase Edge Functions</span>
            </div>
          </div>
        </Card>

        {/* Security Notice */}
        <Card className="p-6 bg-yellow-50 border-yellow-200">
          <div className="flex items-center gap-3 mb-4">
            <Shield className="h-6 w-6 text-yellow-600" />
            <h2 className="text-xl font-semibold text-yellow-900">セキュリティに関する注意</h2>
          </div>
          <ul className="space-y-2 text-sm text-yellow-800">
            <li className="flex gap-2">
              <span>•</span>
              <span>Twitter AppのAPI KeyとSecretは安全に暗号化されてデータベースに保存されます</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>OAuth 2.0トークンは定期的に自動更新されます</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>すべてのAPI呼び出しはRow Level Security（RLS）で保護されています</span>
            </li>
            <li className="flex gap-2">
              <span>•</span>
              <span>アカウント情報は他のユーザーからアクセスできません</span>
            </li>
          </ul>
        </Card>
      </div>
    </div>
  );
}
