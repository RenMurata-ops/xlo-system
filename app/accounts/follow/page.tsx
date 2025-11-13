'use client';

import { useState, useEffect } from 'react';
import { Plus, UserPlus, RefreshCw, Upload, CheckCircle, XCircle, Search, Filter, Star } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { cn } from '@/lib/utils';
import FollowAccountForm from '@/components/accounts/FollowAccountForm';

interface FollowAccount {
  id: string;
  target_handle: string;
  target_name: string;
  followers_count: number;
  priority: number;
  category: string | null;
  tags: string[] | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

export default function FollowAccountsPage() {
  const [accounts, setAccounts] = useState<FollowAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [filter, setFilter] = useState<'all' | 'active' | 'inactive'>('all');
  const [categoryFilter, setCategoryFilter] = useState<string>('all');
  const [priorityFilter, setPriorityFilter] = useState<'all' | 'high' | 'medium' | 'low'>('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [importLoading, setImportLoading] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadAccounts();
  }, [filter, categoryFilter, priorityFilter]);

  async function loadAccounts() {
    try {
      setLoading(true);

      let query = supabase
        .from('follow_accounts')
        .select('*')
        .order('priority', { ascending: false })
        .order('created_at', { ascending: false});

      if (filter === 'active') {
        query = query.eq('is_active', true);
      } else if (filter === 'inactive') {
        query = query.eq('is_active', false);
      }

      if (categoryFilter !== 'all') {
        query = query.eq('category', categoryFilter);
      }

      if (priorityFilter === 'high') {
        query = query.gte('priority', 8);
      } else if (priorityFilter === 'medium') {
        query = query.gte('priority', 5).lt('priority', 8);
      } else if (priorityFilter === 'low') {
        query = query.lt('priority', 5);
      }

      const { data, error } = await query;

      if (error) throw error;
      setAccounts(data || []);
    } catch (error) {
      console.error('Error loading accounts:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('このフォローアカウントを削除してもよろしいですか？')) return;

    try {
      const { error } = await supabase
        .from('follow_accounts')
        .delete()
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.filter(acc => acc.id !== id));
    } catch (error) {
      console.error('Error deleting account:', error);
      alert('削除に失敗しました');
    }
  }

  async function handleToggleActive(id: string, currentStatus: boolean) {
    try {
      const { error } = await supabase
        .from('follow_accounts')
        .update({ is_active: !currentStatus, updated_at: new Date().toISOString() })
        .eq('id', id);

      if (error) throw error;

      setAccounts(accounts.map(acc =>
        acc.id === id ? { ...acc, is_active: !currentStatus } : acc
      ));
    } catch (error) {
      console.error('Error toggling status:', error);
      alert('ステータス変更に失敗しました');
    }
  }

  async function handleCSVImport(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;

    setImportLoading(true);

    try {
      const text = await file.text();
      const lines = text.split('\n').filter(line => line.trim());
      const headers = lines[0].split(',').map(h => h.trim());

      // Validate headers
      const requiredHeaders = ['target_handle', 'target_name'];
      const hasRequiredHeaders = requiredHeaders.every(h =>
        headers.some(header => header.toLowerCase() === h)
      );

      if (!hasRequiredHeaders) {
        alert('CSVファイルには target_handle, target_name 列が必要です');
        return;
      }

      const importData = [];
      for (let i = 1; i < lines.length; i++) {
        const values = lines[i].split(',').map(v => v.trim());
        if (values.length < 2) continue;

        const rowData: any = {};
        headers.forEach((header, index) => {
          rowData[header.toLowerCase()] = values[index] || '';
        });

        importData.push({
          target_handle: rowData.target_handle.replace('@', ''),
          target_name: rowData.target_name,
          followers_count: parseInt(rowData.followers_count) || 0,
          priority: parseInt(rowData.priority) || 5,
          category: rowData.category || null,
          tags: rowData.tags ? rowData.tags.split(';').filter((t: string) => t) : [],
        });
      }

      // Bulk insert
      const { data, error } = await supabase
        .from('follow_accounts')
        .insert(importData)
        .select();

      if (error) throw error;

      setSuccessMessage(`${data.length}件のアカウントをインポートしました`);
      setTimeout(() => setSuccessMessage(null), 5000);
      setShowImport(false);
      loadAccounts();
    } catch (error) {
      console.error('Import error:', error);
      alert('インポートに失敗しました。CSVフォーマットを確認してください。');
    } finally {
      setImportLoading(false);
      if (event.target) {
        event.target.value = '';
      }
    }
  }

  // Filter accounts by search query
  const filteredAccounts = accounts.filter(account =>
    account.target_handle.toLowerCase().includes(searchQuery.toLowerCase()) ||
    account.target_name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  // Get unique categories
  const categories = ['all', ...new Set(accounts.map(acc => acc.category).filter((cat): cat is string => cat !== null))];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    );
  }

  const activeCount = accounts.filter(acc => acc.is_active).length;
  const highPriorityCount = accounts.filter(acc => acc.priority >= 8).length;
  const avgPriority = accounts.length > 0
    ? (accounts.reduce((sum, acc) => sum + acc.priority, 0) / accounts.length).toFixed(1)
    : '0';

  function getPriorityColor(priority: number) {
    if (priority >= 8) return 'text-red-500';
    if (priority >= 5) return 'text-orange-500';
    return 'text-gray-500';
  }

  function getPriorityBadge(priority: number) {
    if (priority >= 8) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-red-500 text-white flex items-center gap-1">
          <Star className="h-3 w-3 fill-white" />
          高優先度
        </span>
      );
    }
    if (priority >= 5) {
      return (
        <span className="text-xs px-2 py-0.5 rounded bg-orange-500 text-white">
          中優先度
        </span>
      );
    }
    return (
      <span className="text-xs px-2 py-0.5 rounded bg-gray-500 text-white">
        低優先度
      </span>
    );
  }

  return (
    <div className="container mx-auto p-6 max-w-7xl">
      {successMessage && (
        <Card className="mb-6 p-4 bg-green-900/20 border-green-700 text-green-400">
          {successMessage}
        </Card>
      )}

      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-3xl font-bold flex items-center gap-2">
              <UserPlus className="h-8 w-8" />
              フォローアカウント
            </h1>
            <p className="text-muted-foreground mt-1">
              {accounts.length} アカウント | {activeCount} アクティブ | {highPriorityCount} 高優先度
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button onClick={() => setShowImport(!showImport)} variant="outline" size="sm">
              <Upload className="h-4 w-4 mr-2" />
              CSV インポート
            </Button>
            <Button onClick={loadAccounts} variant="outline" size="sm" disabled={loading}>
              <RefreshCw className={cn('h-4 w-4 mr-2', loading && 'animate-spin')} />
              更新
            </Button>
            <Button onClick={() => setShowForm(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              新規登録
            </Button>
          </div>
        </div>

        {/* CSV Import Section */}
        {showImport && (
          <Card className="p-4 mb-4">
            <h3 className="font-semibold mb-2">CSV一括インポート</h3>
            <p className="text-sm text-muted-foreground mb-3">
              CSVフォーマット: target_handle, target_name, followers_count, priority, category, tags
            </p>
            <Input
              type="file"
              accept=".csv"
              onChange={handleCSVImport}
              disabled={importLoading}
            />
            {importLoading && (
              <p className="text-sm text-muted-foreground mt-2">インポート中...</p>
            )}
          </Card>
        )}

        {/* Search and Filters */}
        <div className="flex items-center gap-4 flex-wrap">
          <div className="flex-1 min-w-[200px] max-w-md">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="アカウント検索..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Filter className="h-4 w-4 text-muted-foreground" />
            <Button
              variant={filter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={filter === 'active' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('active')}
            >
              アクティブ
            </Button>
            <Button
              variant={filter === 'inactive' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setFilter('inactive')}
            >
              非アクティブ
            </Button>
          </div>

          <div className="flex items-center gap-2">
            <Button
              variant={priorityFilter === 'all' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPriorityFilter('all')}
            >
              すべて
            </Button>
            <Button
              variant={priorityFilter === 'high' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPriorityFilter('high')}
            >
              高優先度
            </Button>
            <Button
              variant={priorityFilter === 'medium' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPriorityFilter('medium')}
            >
              中優先度
            </Button>
            <Button
              variant={priorityFilter === 'low' ? 'default' : 'ghost'}
              size="sm"
              onClick={() => setPriorityFilter('low')}
            >
              低優先度
            </Button>
          </div>

          {categories.length > 1 && (
            <div className="flex items-center gap-2">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={categoryFilter === cat ? 'default' : 'ghost'}
                  size="sm"
                  onClick={() => setCategoryFilter(cat)}
                >
                  {cat === 'all' ? 'すべて' : cat}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">総アカウント数</div>
          <div className="text-3xl font-bold">{accounts.length}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">アクティブ</div>
          <div className="text-3xl font-bold text-green-600">{activeCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">高優先度</div>
          <div className="text-3xl font-bold text-red-600">{highPriorityCount}</div>
        </Card>
        <Card className="p-4">
          <div className="text-sm text-muted-foreground mb-1">平均優先度</div>
          <div className="text-3xl font-bold text-purple-600">{avgPriority}</div>
        </Card>
      </div>

      {/* Accounts List */}
      {filteredAccounts.length === 0 ? (
        <Card className="p-12 text-center">
          <UserPlus className="h-16 w-16 mx-auto mb-4 text-muted-foreground opacity-50" />
          <h3 className="text-lg font-semibold mb-2">
            {searchQuery ? 'アカウントが見つかりません' : 'フォローアカウントが登録されていません'}
          </h3>
          <p className="text-muted-foreground mb-4">
            {searchQuery ? '検索条件を変更してください' : 'フォロー対象のアカウントを登録してください'}
          </p>
          {!searchQuery && (
            <Button onClick={() => setShowForm(true)}>
              <Plus className="h-4 w-4 mr-2" />
              最初のアカウントを登録
            </Button>
          )}
        </Card>
      ) : (
        <div className="grid gap-4">
          {filteredAccounts.map(account => (
            <Card key={account.id} className="p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-3 mb-2 flex-wrap">
                    <div>
                      <h3 className="font-semibold text-lg">@{account.target_handle}</h3>
                      <p className="text-sm text-muted-foreground">{account.target_name}</p>
                    </div>
                    {getPriorityBadge(account.priority)}
                    {account.is_active ? (
                      <span className="text-xs px-2 py-0.5 rounded bg-green-500 text-white">
                        アクティブ
                      </span>
                    ) : (
                      <span className="text-xs px-2 py-0.5 rounded bg-gray-500 text-white">
                        非アクティブ
                      </span>
                    )}
                    {account.category && (
                      <span className="text-xs px-2 py-0.5 rounded bg-blue-500 text-white">
                        {account.category}
                      </span>
                    )}
                  </div>

                  <div className="flex items-center gap-4 text-sm text-muted-foreground">
                    <span>{account.followers_count.toLocaleString()} フォロワー</span>
                    <span className={cn('font-semibold', getPriorityColor(account.priority))}>
                      優先度: {account.priority}/10
                    </span>
                  </div>

                  {account.tags && account.tags.length > 0 && (
                    <div className="mt-2 flex items-center gap-2 flex-wrap">
                      {account.tags.map((tag) => (
                        <span
                          key={tag}
                          className="text-xs px-2 py-0.5 rounded bg-secondary"
                        >
                          {tag}
                        </span>
                      ))}
                    </div>
                  )}
                </div>

                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleToggleActive(account.id, account.is_active)}
                    title={account.is_active ? '非アクティブ化' : 'アクティブ化'}
                  >
                    {account.is_active ? (
                      <XCircle className="h-4 w-4 text-red-500" />
                    ) : (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => handleDelete(account.id)}
                    title="削除"
                    className="text-destructive"
                  >
                    <XCircle className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}

      {/* Form */}
      {showForm && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowForm(false)} />
          <div className="fixed inset-4 md:inset-auto md:top-1/2 md:left-1/2 md:-translate-x-1/2 md:-translate-y-1/2 md:w-full md:max-w-2xl z-50">
            <FollowAccountForm
              onClose={() => {
                setShowForm(false);
                loadAccounts();
              }}
            />
          </div>
        </>
      )}
    </div>
  );
}
