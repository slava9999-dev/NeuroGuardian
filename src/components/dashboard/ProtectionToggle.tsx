// ============================================
// NeuroGUARDIAN — Protection Toggle
// Big toggle button with confirmation
// ============================================

import { useState } from 'react';
import { hapticFeedback } from '../../lib/telegram';

interface ProtectionToggleProps {
  enabled: boolean;
  subscriptionActive: boolean;
  onToggle: (enabled: boolean) => Promise<void>;
  className?: string;
}

export function ProtectionToggle({
  enabled,
  subscriptionActive,
  onToggle,
  className = '',
}: ProtectionToggleProps) {
  const [loading, setLoading] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const handleToggle = async () => {
    // If disabling, show confirmation
    if (enabled) {
      setShowConfirm(true);
      hapticFeedback('warning');
      return;
    }

    // If enabling, check subscription
    if (!subscriptionActive) {
      hapticFeedback('error');
      alert('Для включения защиты необходима подписка');
      return;
    }

    await performToggle(true);
  };

  const performToggle = async (newState: boolean) => {
    setLoading(true);
    setShowConfirm(false);

    try {
      await onToggle(newState);
      hapticFeedback(newState ? 'success' : 'light');
    } catch (error) {
      console.error('Toggle failed:', error);
      hapticFeedback('error');
    } finally {
      setLoading(false);
    }
  };

  const confirmDisable = () => {
    performToggle(false);
  };

  const cancelDisable = () => {
    setShowConfirm(false);
    hapticFeedback('light');
  };

  return (
    <div className={`protection-toggle ${className}`}>
      {/* Main Toggle */}
      <div
        className={`toggle-container ${enabled ? 'enabled' : 'disabled'} ${loading ? 'loading' : ''}`}
        onClick={loading ? undefined : handleToggle}
      >
        <div className="toggle-content">
          <div className="toggle-icon">{enabled ? '🛡️' : '⏸️'}</div>
          <div className="toggle-text">
            <div className="toggle-title">{enabled ? 'Защита активна' : 'Защита отключена'}</div>
            <div className="toggle-subtitle">
              {enabled ? 'Автоматический мониторинг цен' : 'Нажмите для включения'}
            </div>
          </div>
        </div>
        <div className={`toggle-switch ${enabled ? 'on' : 'off'}`}>
          <div className="toggle-dot" />
        </div>
      </div>

      {/* Subscription Warning */}
      {!subscriptionActive && !enabled && (
        <div className="subscription-warning">⚠️ Требуется подписка для активации</div>
      )}

      {/* Confirmation Modal */}
      {showConfirm && (
        <div className="confirm-overlay" onClick={cancelDisable}>
          <div className="confirm-modal" onClick={e => e.stopPropagation()}>
            <div className="confirm-icon">⚠️</div>
            <div className="confirm-title">Отключить защиту?</div>
            <div className="confirm-text">
              Автоматический мониторинг будет остановлен. Ваши товары не будут защищены от демпинга.
            </div>
            <div className="confirm-buttons">
              <button className="cancel-btn" onClick={cancelDisable}>
                Отмена
              </button>
              <button className="confirm-btn" onClick={confirmDisable}>
                Отключить
              </button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .protection-toggle {
          position: relative;
        }

        .toggle-container {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
          border-radius: 16px;
          cursor: pointer;
          transition: all 0.3s ease;
          border: 2px solid transparent;
        }

        .toggle-container.enabled {
          border-color: #22c55e;
          background: linear-gradient(135deg, rgba(34, 197, 94, 0.1) 0%, #1a1a2e 100%);
        }

        .toggle-container.disabled {
          opacity: 0.8;
        }

        .toggle-container.loading {
          opacity: 0.5;
          pointer-events: none;
        }

        .toggle-container:hover:not(.loading) {
          transform: translateY(-2px);
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.3);
        }

        .toggle-content {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .toggle-icon {
          font-size: 32px;
        }

        .toggle-title {
          font-size: 16px;
          font-weight: 600;
          color: #fff;
        }

        .toggle-subtitle {
          font-size: 13px;
          color: #9ca3af;
          margin-top: 2px;
        }

        .toggle-switch {
          width: 52px;
          height: 28px;
          background: #374151;
          border-radius: 14px;
          position: relative;
          transition: all 0.3s ease;
        }

        .toggle-switch.on {
          background: #22c55e;
        }

        .toggle-dot {
          position: absolute;
          top: 2px;
          left: 2px;
          width: 24px;
          height: 24px;
          background: #fff;
          border-radius: 50%;
          transition: all 0.3s ease;
          box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
        }

        .toggle-switch.on .toggle-dot {
          left: 26px;
        }

        .subscription-warning {
          text-align: center;
          padding: 8px;
          font-size: 13px;
          color: #f59e0b;
          margin-top: 8px;
        }

        .confirm-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.7);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .confirm-modal {
          background: #1a1a2e;
          border-radius: 20px;
          padding: 24px;
          max-width: 320px;
          text-align: center;
        }

        .confirm-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }

        .confirm-title {
          font-size: 18px;
          font-weight: 600;
          color: #fff;
          margin-bottom: 8px;
        }

        .confirm-text {
          font-size: 14px;
          color: #9ca3af;
          margin-bottom: 20px;
          line-height: 1.5;
        }

        .confirm-buttons {
          display: flex;
          gap: 12px;
        }

        .confirm-buttons button {
          flex: 1;
          padding: 12px;
          border: none;
          border-radius: 12px;
          font-size: 14px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .cancel-btn {
          background: rgba(255, 255, 255, 0.1);
          color: #fff;
        }

        .cancel-btn:hover {
          background: rgba(255, 255, 255, 0.2);
        }

        .confirm-btn {
          background: #ef4444;
          color: #fff;
        }

        .confirm-btn:hover {
          background: #dc2626;
        }
      `}</style>
    </div>
  );
}

export default ProtectionToggle;
