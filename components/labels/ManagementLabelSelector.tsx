'use client';

import { useState, useEffect } from 'react';
import { Plus, X, Tag, Check } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

interface ManagementLabel {
  id: string;
  name: string;
  color: string;
}

interface ManagementLabelSelectorProps {
  selectedLabelId: string | null;
  onSelect: (labelId: string | null) => void;
  showCreateButton?: boolean;
}

const PRESET_COLORS = [
  '#EF4444', // Red
  '#F97316', // Orange
  '#F59E0B', // Amber
  '#84CC16', // Lime
  '#10B981', // Emerald
  '#06B6D4', // Cyan
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#6B7280', // Gray
];

export default function ManagementLabelSelector({
  selectedLabelId,
  onSelect,
  showCreateButton = true,
}: ManagementLabelSelectorProps) {
  const [labels, setLabels] = useState<ManagementLabel[]>([]);
  const [loading, setLoading] = useState(true);
  const [showDropdown, setShowDropdown] = useState(false);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [newLabelName, setNewLabelName] = useState('');
  const [newLabelColor, setNewLabelColor] = useState('#3B82F6');
  const [creating, setCreating] = useState(false);
  const supabase = createClient();

  useEffect(() => {
    loadLabels();
  }, []);

  async function loadLabels() {
    try {
      const { data, error } = await supabase
        .from('management_labels')
        .select('*')
        .order('name', { ascending: true });

      if (error) throw error;
      setLabels(data || []);
    } catch (error) {
      console.error('Error loading labels:', error);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreateLabel() {
    if (!newLabelName.trim()) return;

    setCreating(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Not authenticated');

      const { data, error } = await supabase
        .from('management_labels')
        .insert({
          user_id: user.id,
          name: newLabelName.trim(),
          color: newLabelColor,
        })
        .select()
        .single();

      if (error) throw error;

      setLabels([...labels, data]);
      setNewLabelName('');
      setShowCreateForm(false);
      onSelect(data.id);
    } catch (error: any) {
      console.error('Error creating label:', error);
      alert(error.message || 'ラベルの作成に失敗しました');
    } finally {
      setCreating(false);
    }
  }

  const selectedLabel = labels.find(l => l.id === selectedLabelId);

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setShowDropdown(!showDropdown)}
        className="flex items-center gap-2 px-3 py-2 bg-white border border-gray-300 rounded-lg text-sm hover:bg-gray-50 transition w-full justify-between"
      >
        {selectedLabel ? (
          <span className="flex items-center gap-2">
            <span
              className="w-3 h-3 rounded-full"
              style={{ backgroundColor: selectedLabel.color }}
            />
            {selectedLabel.name}
          </span>
        ) : (
          <span className="text-gray-500 flex items-center gap-2">
            <Tag size={14} />
            ラベルを選択
          </span>
        )}
        <svg className="w-4 h-4 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {showDropdown && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-gray-200 rounded-lg shadow-lg">
          <div className="max-h-60 overflow-y-auto">
            {/* None option */}
            <button
              type="button"
              onClick={() => {
                onSelect(null);
                setShowDropdown(false);
              }}
              className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
            >
              <span className="w-3 h-3 rounded-full bg-gray-200" />
              <span className="text-gray-500">なし</span>
              {!selectedLabelId && <Check size={14} className="ml-auto text-blue-600" />}
            </button>

            {/* Labels */}
            {labels.map(label => (
              <button
                key={label.id}
                type="button"
                onClick={() => {
                  onSelect(label.id);
                  setShowDropdown(false);
                }}
                className="w-full px-3 py-2 text-left text-sm hover:bg-gray-50 flex items-center gap-2"
              >
                <span
                  className="w-3 h-3 rounded-full flex-shrink-0"
                  style={{ backgroundColor: label.color }}
                />
                {label.name}
                {selectedLabelId === label.id && (
                  <Check size={14} className="ml-auto text-blue-600" />
                )}
              </button>
            ))}

            {loading && (
              <div className="px-3 py-2 text-sm text-gray-500">読み込み中...</div>
            )}
          </div>

          {/* Create new label */}
          {showCreateButton && (
            <div className="border-t border-gray-200">
              {showCreateForm ? (
                <div className="p-3 space-y-3">
                  <input
                    type="text"
                    value={newLabelName}
                    onChange={(e) => setNewLabelName(e.target.value)}
                    placeholder="ラベル名"
                    className="w-full px-3 py-2 border border-gray-300 rounded text-sm"
                    autoFocus
                  />
                  <div className="flex flex-wrap gap-1">
                    {PRESET_COLORS.map(color => (
                      <button
                        key={color}
                        type="button"
                        onClick={() => setNewLabelColor(color)}
                        className={`w-6 h-6 rounded-full border-2 ${
                          newLabelColor === color ? 'border-gray-900' : 'border-transparent'
                        }`}
                        style={{ backgroundColor: color }}
                      />
                    ))}
                  </div>
                  <div className="flex gap-2">
                    <button
                      type="button"
                      onClick={() => setShowCreateForm(false)}
                      className="flex-1 px-3 py-1.5 text-sm border border-gray-300 rounded hover:bg-gray-50"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleCreateLabel}
                      disabled={creating || !newLabelName.trim()}
                      className="flex-1 px-3 py-1.5 text-sm bg-blue-600 text-white rounded hover:bg-blue-700 disabled:opacity-50"
                    >
                      {creating ? '作成中...' : '作成'}
                    </button>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setShowCreateForm(true)}
                  className="w-full px-3 py-2 text-left text-sm text-blue-600 hover:bg-blue-50 flex items-center gap-2"
                >
                  <Plus size={14} />
                  新しいラベルを作成
                </button>
              )}
            </div>
          )}
        </div>
      )}

      {/* Click outside to close */}
      {showDropdown && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => {
            setShowDropdown(false);
            setShowCreateForm(false);
          }}
        />
      )}
    </div>
  );
}
