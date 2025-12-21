// ============================================
// NeuroAgent — Rules Page
// User automation rules management
// ============================================

import { useState, useEffect } from 'react';
import { hapticFeedback } from '../lib/telegram';
import { rulesApi, type UserRuleData, type RuleTemplate } from '../lib/api';

// Trigger type display names
const TRIGGER_NAMES: Record<string, string> = {
  competitor_price_below: '📉 Конкурент снизил цену',
  competitor_price_change: '📊 Изменение цены конкурента',
  my_price_below_cost: '⚠️ Цена ниже себестоимости',
  stock_below: '📦 Низкий остаток',
  daily_check: '📅 Ежедневная проверка',
  new_competitor: '🆕 Новый конкурент',
};

// Action type display names
const ACTION_NAMES: Record<string, string> = {
  notify: '🔔 Уведомить',
  lower_price_percent: '📉 Снизить цену на %',
  lower_price_absolute: '📉 Снизить цену на ₽',
  match_competitor: '🎯 Сравнять с конкурентом',
  undercut_competitor: '⚡ Сделать дешевле',
  set_min_price: '🛡️ Установить минимум',
  pause_sales: '⏸️ Приостановить продажи',
};

export function RulesPage({ onBack }: { onBack: () => void }) {
  const [rules, setRules] = useState<UserRuleData[]>([]);
  const [templates, setTemplates] = useState<RuleTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedTemplate, setSelectedTemplate] = useState<RuleTemplate | null>(null);
  const [error, setError] = useState<string | null>(null);

  // New rule form state
  const [newRuleName, setNewRuleName] = useState('');
  const [newRuleValue, setNewRuleValue] = useState('');

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    setIsLoading(true);
    try {
      const [rulesResult, templatesResult] = await Promise.all([
        rulesApi.getRules(),
        rulesApi.getTemplates(),
      ]);
      setRules(rulesResult.rules || []);
      setTemplates(templatesResult.templates || []);
    } catch (err) {
      console.error('Failed to load rules:', err);
      setError('Не удалось загрузить правила');
    } finally {
      setIsLoading(false);
    }
  };

  const handleToggleRule = async (ruleId: string) => {
    hapticFeedback('light');
    try {
      const result = await rulesApi.toggleRule(ruleId);
      if (result.success) {
        setRules(prev =>
          prev.map(r => (r.id === ruleId ? { ...r, isActive: result.isActive } : r))
        );
        hapticFeedback('success');
      }
    } catch (err) {
      console.error('Toggle error:', err);
      hapticFeedback('error');
    }
  };

  const handleDeleteRule = async (ruleId: string) => {
    hapticFeedback('warning');
    if (!confirm('Удалить это правило?')) return;

    try {
      const result = await rulesApi.deleteRule(ruleId);
      if (result.success) {
        setRules(prev => prev.filter(r => r.id !== ruleId));
        hapticFeedback('success');
      }
    } catch (err) {
      console.error('Delete error:', err);
      hapticFeedback('error');
    }
  };

  const handleCreateFromTemplate = async () => {
    if (!selectedTemplate || !newRuleName) return;

    hapticFeedback('medium');
    setIsLoading(true);

    try {
      const condition = {
        ...selectedTemplate.condition,
        targetValue: newRuleValue
          ? parseFloat(newRuleValue)
          : selectedTemplate.condition.targetValue,
      };

      const result = await rulesApi.createRule({
        name: newRuleName,
        description: selectedTemplate.description,
        condition,
        action: selectedTemplate.action,
        maxTriggersPerDay: selectedTemplate.maxTriggersPerDay,
        cooldownMinutes: selectedTemplate.cooldownMinutes,
      });

      if (result.success) {
        await loadData();
        setShowCreateModal(false);
        setSelectedTemplate(null);
        setNewRuleName('');
        setNewRuleValue('');
        hapticFeedback('success');
      }
    } catch (err) {
      console.error('Create error:', err);
      hapticFeedback('error');
      setError('Не удалось создать правило');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-stone-900 to-stone-800 px-4 py-6 pb-24">
      {/* Header */}
      <header className="flex items-center gap-4 mb-6">
        <button
          onClick={onBack}
          className="p-2 rounded-xl bg-stone-800 hover:bg-stone-700 transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M19 12H5M12 19l-7-7 7-7" />
          </svg>
        </button>
        <div className="flex-1">
          <h1 className="text-xl font-bold text-white">Правила автоматизации</h1>
          <p className="text-sm text-stone-400">Настройте автоматические действия</p>
        </div>
        <button
          onClick={() => setShowCreateModal(true)}
          className="p-2 rounded-xl bg-amber-500/20 text-amber-400 hover:bg-amber-500/30 transition-colors"
        >
          <svg
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
        </button>
      </header>

      {/* Error */}
      {error && (
        <div className="mb-4 p-3 rounded-xl bg-red-500/20 border border-red-500/30 text-red-400 text-sm">
          {error}
        </div>
      )}

      {/* Loading */}
      {isLoading ? (
        <div className="flex items-center justify-center py-20">
          <div className="animate-spin w-10 h-10 border-2 border-amber-500 border-t-transparent rounded-full" />
        </div>
      ) : rules.length === 0 ? (
        // Empty state
        <div className="text-center py-16">
          <div className="w-20 h-20 mx-auto mb-4 rounded-full bg-stone-800 flex items-center justify-center">
            <svg
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              className="text-stone-500"
            >
              <path d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 0 0 1.946-.806 3.42 3.42 0 0 1 4.438 0 3.42 3.42 0 0 0 1.946.806 3.42 3.42 0 0 1 3.138 3.138 3.42 3.42 0 0 0 .806 1.946 3.42 3.42 0 0 1 0 4.438 3.42 3.42 0 0 0-.806 1.946 3.42 3.42 0 0 1-3.138 3.138 3.42 3.42 0 0 0-1.946.806 3.42 3.42 0 0 1-4.438 0 3.42 3.42 0 0 0-1.946-.806 3.42 3.42 0 0 1-3.138-3.138 3.42 3.42 0 0 0-.806-1.946 3.42 3.42 0 0 1 0-4.438 3.42 3.42 0 0 0 .806-1.946 3.42 3.42 0 0 1 3.138-3.138z" />
            </svg>
          </div>
          <h3 className="text-lg font-semibold text-white mb-2">Нет правил</h3>
          <p className="text-stone-400 text-sm mb-6">
            Создайте правило для автоматической защиты маржи
          </p>
          <button onClick={() => setShowCreateModal(true)} className="btn-primary">
            ➕ Создать правило
          </button>
        </div>
      ) : (
        // Rules list
        <div className="space-y-3">
          {rules.map(rule => (
            <div
              key={rule.id}
              className={`glass-panel p-4 transition-all ${rule.isActive ? 'border-amber-500/30' : 'opacity-60'}`}
            >
              <div className="flex items-start justify-between mb-2">
                <div className="flex-1">
                  <h4 className="font-medium text-white flex items-center gap-2">
                    {rule.name}
                    {rule.isActive && (
                      <span className="px-1.5 py-0.5 rounded text-xs font-medium bg-emerald-500/20 text-emerald-400">
                        Активно
                      </span>
                    )}
                  </h4>
                  {rule.description && (
                    <p className="text-sm text-stone-400 mt-1">{rule.description}</p>
                  )}
                </div>

                {/* Toggle */}
                <button
                  onClick={() => handleToggleRule(rule.id)}
                  className={`relative w-12 h-6 rounded-full transition-colors ${
                    rule.isActive ? 'bg-amber-500' : 'bg-stone-700'
                  }`}
                >
                  <span
                    className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                      rule.isActive ? 'left-7' : 'left-1'
                    }`}
                  />
                </button>
              </div>

              {/* Rule details */}
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="px-2 py-1 rounded-lg bg-stone-800 text-xs text-stone-400">
                  {TRIGGER_NAMES[rule.triggerType] || rule.triggerType}
                </span>
                <span className="px-2 py-1 rounded-lg bg-stone-800 text-xs text-stone-400">
                  → {ACTION_NAMES[rule.actionType] || rule.actionType}
                </span>
              </div>

              {/* Stats & actions */}
              <div className="flex items-center justify-between text-xs text-stone-500">
                <span>
                  Сработало: {rule.triggersToday}/{rule.maxTriggersPerDay} сегодня
                </span>
                <button
                  onClick={() => handleDeleteRule(rule.id)}
                  className="text-red-400 hover:text-red-300"
                >
                  Удалить
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Create Rule Modal */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 backdrop-blur-sm p-4">
          <div className="w-full max-w-md max-h-[80vh] overflow-y-auto glass-panel p-6">
            <h3 className="text-lg font-bold text-white mb-4">Создать правило</h3>

            {/* Templates */}
            {!selectedTemplate ? (
              <div className="space-y-3 mb-6">
                <p className="text-sm text-stone-400 mb-3">Выберите шаблон:</p>
                {templates.map(template => (
                  <button
                    key={template.id}
                    onClick={() => {
                      setSelectedTemplate(template);
                      hapticFeedback('light');
                    }}
                    className="w-full text-left glass-panel p-4 hover:border-amber-500/50 transition-colors"
                  >
                    <h4 className="font-medium text-white mb-1">
                      {TRIGGER_NAMES[template.condition.triggerType] || template.id}
                    </h4>
                    <p className="text-sm text-stone-400">{template.description}</p>
                  </button>
                ))}
              </div>
            ) : (
              // Configure selected template
              <div className="space-y-4 mb-6">
                <div className="p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                  <p className="text-sm text-amber-400">
                    {TRIGGER_NAMES[selectedTemplate.condition.triggerType]}
                  </p>
                  <p className="text-xs text-stone-400 mt-1">{selectedTemplate.description}</p>
                </div>

                <div>
                  <label className="block text-sm text-stone-400 mb-2">Название правила</label>
                  <input
                    type="text"
                    value={newRuleName}
                    onChange={e => setNewRuleName(e.target.value)}
                    placeholder="Например: Защита от демпинга"
                    className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
                  />
                </div>

                {selectedTemplate.condition.targetValue !== undefined && (
                  <div>
                    <label className="block text-sm text-stone-400 mb-2">
                      {selectedTemplate.condition.triggerType === 'stock_below'
                        ? 'Минимальный остаток (шт)'
                        : 'Порог цены (₽)'}
                    </label>
                    <input
                      type="number"
                      value={newRuleValue}
                      onChange={e => setNewRuleValue(e.target.value)}
                      placeholder={String(selectedTemplate.condition.targetValue || 0)}
                      className="w-full p-3 rounded-xl bg-stone-800 border border-stone-700 text-white placeholder:text-stone-500 focus:border-amber-500 focus:outline-none"
                    />
                  </div>
                )}
              </div>
            )}

            <div className="flex gap-3">
              <button
                onClick={() => {
                  if (selectedTemplate) {
                    setSelectedTemplate(null);
                  } else {
                    setShowCreateModal(false);
                  }
                  setNewRuleName('');
                  setNewRuleValue('');
                }}
                className="flex-1 btn-secondary"
              >
                {selectedTemplate ? 'Назад' : 'Отмена'}
              </button>
              {selectedTemplate && (
                <button
                  onClick={handleCreateFromTemplate}
                  disabled={!newRuleName || isLoading}
                  className="flex-1 btn-primary disabled:opacity-50"
                >
                  {isLoading ? 'Создание...' : 'Создать'}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
