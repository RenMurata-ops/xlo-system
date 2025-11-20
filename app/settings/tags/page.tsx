'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, Tag, FolderOpen, RefreshCw, Save, X } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { toast } from 'sonner';

interface TagItem {
  name: string;
  count: number;
  sources: string[];
}

interface CategoryItem {
  name: string;
  count: number;
  source: string;
}

export default function TagsManagementPage() {
  const [tags, setTags] = useState<TagItem[]>([]);
  const [categories, setCategories] = useState<CategoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingTag, setEditingTag] = useState<{ old: string; new: string } | null>(null);
  const [editingCategory, setEditingCategory] = useState<{ old: string; new: string; source: string } | null>(null);
  const [newTag, setNewTag] = useState('');
  const [newCategory, setNewCategory] = useState('');
  const supabase = createClient();

  useEffect(() => {
    loadTagsAndCategories();
  }, []);

  async function loadTagsAndCategories() {
    setLoading(true);
    try {
      // Load tags from multiple sources
      const tagMap = new Map<string, { count: number; sources: Set<string> }>();

      // From post_templates
      const { data: templates } = await supabase
        .from('post_templates')
        .select('tags');

      templates?.forEach(t => {
        t.tags?.forEach((tag: string) => {
          const existing = tagMap.get(tag) || { count: 0, sources: new Set() };
          existing.count++;
          existing.sources.add('テンプレート');
          tagMap.set(tag, existing);
        });
      });

      // From posts
      const { data: posts } = await supabase
        .from('posts')
        .select('tags');

      posts?.forEach(p => {
        p.tags?.forEach((tag: string) => {
          const existing = tagMap.get(tag) || { count: 0, sources: new Set() };
          existing.count++;
          existing.sources.add('投稿');
          tagMap.set(tag, existing);
        });
      });

      // From spam_accounts
      const { data: spamAccounts } = await supabase
        .from('spam_accounts')
        .select('tags');

      spamAccounts?.forEach(a => {
        a.tags?.forEach((tag: string) => {
          const existing = tagMap.get(tag) || { count: 0, sources: new Set() };
          existing.count++;
          existing.sources.add('スパムアカウント');
          tagMap.set(tag, existing);
        });
      });

      // From follow_accounts
      const { data: followAccounts } = await supabase
        .from('follow_accounts')
        .select('tags');

      followAccounts?.forEach(a => {
        a.tags?.forEach((tag: string) => {
          const existing = tagMap.get(tag) || { count: 0, sources: new Set() };
          existing.count++;
          existing.sources.add('フォローアカウント');
          tagMap.set(tag, existing);
        });
      });

      // From main_accounts
      const { data: mainAccounts } = await supabase
        .from('main_accounts')
        .select('tags');

      mainAccounts?.forEach(a => {
        a.tags?.forEach((tag: string) => {
          const existing = tagMap.get(tag) || { count: 0, sources: new Set() };
          existing.count++;
          existing.sources.add('メインアカウント');
          tagMap.set(tag, existing);
        });
      });

      const tagList: TagItem[] = [];
      tagMap.forEach((value, key) => {
        tagList.push({
          name: key,
          count: value.count,
          sources: Array.from(value.sources),
        });
      });

      setTags(tagList.sort((a, b) => b.count - a.count));

      // Load categories from templates
      const categoryMap = new Map<string, number>();

      const { data: templateCategories } = await supabase
        .from('post_templates')
        .select('category');

      templateCategories?.forEach(t => {
        if (t.category) {
          categoryMap.set(t.category, (categoryMap.get(t.category) || 0) + 1);
        }
      });

      const categoryList: CategoryItem[] = [];
      categoryMap.forEach((count, name) => {
        categoryList.push({ name, count, source: 'テンプレート' });
      });

      // Add follow account categories
      const { data: followCategories } = await supabase
        .from('follow_accounts')
        .select('category');

      const followCategoryMap = new Map<string, number>();
      followCategories?.forEach(f => {
        if (f.category) {
          followCategoryMap.set(f.category, (followCategoryMap.get(f.category) || 0) + 1);
        }
      });

      followCategoryMap.forEach((count, name) => {
        categoryList.push({ name, count, source: 'フォローアカウント' });
      });

      setCategories(categoryList.sort((a, b) => b.count - a.count));

    } catch (error) {
      console.error('Error loading tags:', error);
      toast.error('タグの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }

  async function handleRenameTag(oldName: string, newName: string) {
    if (!newName.trim() || newName === oldName) {
      setEditingTag(null);
      return;
    }

    try {
      // Update in all tables that use tags
      const tables = ['post_templates', 'posts', 'spam_accounts', 'follow_accounts', 'main_accounts'];

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select('id, tags')
          .contains('tags', [oldName]);

        if (data && data.length > 0) {
          for (const item of data) {
            const newTags = item.tags.map((t: string) => t === oldName ? newName : t);
            await supabase
              .from(table)
              .update({ tags: newTags })
              .eq('id', item.id);
          }
        }
      }

      toast.success(`タグ "${oldName}" を "${newName}" に変更しました`);
      setEditingTag(null);
      loadTagsAndCategories();
    } catch (error) {
      console.error('Error renaming tag:', error);
      toast.error('タグの変更に失敗しました');
    }
  }

  async function handleDeleteTag(tagName: string) {
    if (!confirm(`タグ "${tagName}" を全ての項目から削除してもよろしいですか？`)) return;

    try {
      const tables = ['post_templates', 'posts', 'spam_accounts', 'follow_accounts', 'main_accounts'];

      for (const table of tables) {
        const { data } = await supabase
          .from(table)
          .select('id, tags')
          .contains('tags', [tagName]);

        if (data && data.length > 0) {
          for (const item of data) {
            const newTags = item.tags.filter((t: string) => t !== tagName);
            await supabase
              .from(table)
              .update({ tags: newTags.length > 0 ? newTags : null })
              .eq('id', item.id);
          }
        }
      }

      toast.success(`タグ "${tagName}" を削除しました`);
      loadTagsAndCategories();
    } catch (error) {
      console.error('Error deleting tag:', error);
      toast.error('タグの削除に失敗しました');
    }
  }

  async function handleRenameCategory(oldName: string, newName: string, source: string) {
    if (!newName.trim() || newName === oldName) {
      setEditingCategory(null);
      return;
    }

    try {
      if (source === 'テンプレート') {
        await supabase
          .from('post_templates')
          .update({ category: newName })
          .eq('category', oldName);
      } else if (source === 'フォローアカウント') {
        await supabase
          .from('follow_accounts')
          .update({ category: newName })
          .eq('category', oldName);
      }

      toast.success(`カテゴリ "${oldName}" を "${newName}" に変更しました`);
      setEditingCategory(null);
      loadTagsAndCategories();
    } catch (error) {
      console.error('Error renaming category:', error);
      toast.error('カテゴリの変更に失敗しました');
    }
  }

  async function handleDeleteCategory(categoryName: string, source: string) {
    if (!confirm(`カテゴリ "${categoryName}" を削除してもよろしいですか？`)) return;

    try {
      if (source === 'テンプレート') {
        await supabase
          .from('post_templates')
          .update({ category: null })
          .eq('category', categoryName);
      } else if (source === 'フォローアカウント') {
        await supabase
          .from('follow_accounts')
          .update({ category: null })
          .eq('category', categoryName);
      }

      toast.success(`カテゴリ "${categoryName}" を削除しました`);
      loadTagsAndCategories();
    } catch (error) {
      console.error('Error deleting category:', error);
      toast.error('カテゴリの削除に失敗しました');
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
    <div className="container mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">タグ・カテゴリ管理</h1>
          <p className="text-gray-600 mt-2">
            システム全体で使用されているタグとカテゴリを管理します
          </p>
        </div>
        <button
          onClick={loadTagsAndCategories}
          className="flex items-center gap-2 px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition"
        >
          <RefreshCw size={20} />
          更新
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* タグ一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <Tag size={24} className="text-blue-600" />
              <h2 className="text-xl font-semibold text-gray-900">タグ一覧</h2>
              <span className="ml-auto text-sm text-gray-500">{tags.length}件</span>
            </div>
          </div>

          <div className="p-6 max-h-[600px] overflow-y-auto">
            {tags.length === 0 ? (
              <p className="text-gray-500 text-center py-8">タグがありません</p>
            ) : (
              <div className="space-y-3">
                {tags.map((tag) => (
                  <div
                    key={tag.name}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    {editingTag?.old === tag.name ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingTag.new}
                          onChange={(e) => setEditingTag({ ...editingTag, new: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameTag(editingTag.old, editingTag.new)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingTag(null)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium text-gray-900">{tag.name}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            {tag.count}件 | {tag.sources.join(', ')}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingTag({ old: tag.name, new: tag.name })}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteTag(tag.name)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* カテゴリ一覧 */}
        <div className="bg-white rounded-lg shadow">
          <div className="p-6 border-b border-gray-200">
            <div className="flex items-center gap-2">
              <FolderOpen size={24} className="text-purple-600" />
              <h2 className="text-xl font-semibold text-gray-900">カテゴリ一覧</h2>
              <span className="ml-auto text-sm text-gray-500">{categories.length}件</span>
            </div>
          </div>

          <div className="p-6 max-h-[600px] overflow-y-auto">
            {categories.length === 0 ? (
              <p className="text-gray-500 text-center py-8">カテゴリがありません</p>
            ) : (
              <div className="space-y-3">
                {categories.map((category, index) => (
                  <div
                    key={`${category.name}-${category.source}-${index}`}
                    className="flex items-center justify-between p-3 bg-gray-50 rounded-lg"
                  >
                    {editingCategory?.old === category.name && editingCategory?.source === category.source ? (
                      <div className="flex items-center gap-2 flex-1">
                        <input
                          type="text"
                          value={editingCategory.new}
                          onChange={(e) => setEditingCategory({ ...editingCategory, new: e.target.value })}
                          className="flex-1 px-2 py-1 border border-gray-300 rounded text-sm"
                          autoFocus
                        />
                        <button
                          onClick={() => handleRenameCategory(editingCategory.old, editingCategory.new, editingCategory.source)}
                          className="p-1 text-green-600 hover:bg-green-50 rounded"
                        >
                          <Save size={16} />
                        </button>
                        <button
                          onClick={() => setEditingCategory(null)}
                          className="p-1 text-gray-600 hover:bg-gray-200 rounded"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    ) : (
                      <>
                        <div>
                          <span className="font-medium text-gray-900">{category.name}</span>
                          <div className="text-xs text-gray-500 mt-1">
                            {category.count}件 | {category.source}
                          </div>
                        </div>
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => setEditingCategory({ old: category.name, new: category.name, source: category.source })}
                            className="p-1 text-blue-600 hover:bg-blue-50 rounded"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={() => handleDeleteCategory(category.name, category.source)}
                            className="p-1 text-red-600 hover:bg-red-50 rounded"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
