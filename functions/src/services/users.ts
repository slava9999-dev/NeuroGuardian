// ============================================
// NeuroGUARDIAN — User Service
// User management and subscription logic
// ============================================

import { v4 as uuidv4 } from 'uuid';
import { db } from '../lib/firestore';
import { 
  type User, 
  type LogEntry,
  PLAN_LIMITS,
  isSubscriptionActive,
  getDaysUntilExpiry,
  checkPlanLimits,
} from '../schemas/models';

// ============================================
// USER CREATION / LOOKUP
// ============================================

interface TelegramUser {
  id: number;
  first_name: string;
  last_name?: string;
  username?: string;
  photo_url?: string;
  language_code?: string;
}

export async function getOrCreateUser(telegramUser: TelegramUser): Promise<User> {
  const userRef = db.collection('users').doc(telegramUser.id.toString());
  const userDoc = await userRef.get();
  
  const now = new Date();
  
  if (userDoc.exists) {
    // Update last active timestamp
    await userRef.update({
      lastActiveAt: now,
      firstName: telegramUser.first_name,
      lastName: telegramUser.last_name || null,
      username: telegramUser.username || null,
      photoUrl: telegramUser.photo_url || null,
    });
    
    return userDoc.data() as User;
  }
  
  // Create new user with trial
  const trialExpiresAt = new Date(now);
  trialExpiresAt.setDate(trialExpiresAt.getDate() + PLAN_LIMITS.trial.durationDays);
  
  const newUser: User = {
    telegramId: telegramUser.id,
    username: telegramUser.username || null,
    firstName: telegramUser.first_name,
    lastName: telegramUser.last_name || null,
    photoUrl: telegramUser.photo_url || null,
    languageCode: telegramUser.language_code || 'ru',
    
    subscriptionPlan: 'trial',
    subscriptionActive: true,
    subscriptionStartedAt: now,
    subscriptionExpiresAt: trialExpiresAt,
    autoRenew: true,
    
    customerId: null,
    paymentMethodId: null,
    totalPaid: 0,
    
    protectionEnabled: false,
    defenseMode: 'zero_stock',
    alertsEnabled: true,
    emailForAlerts: null,
    
    wbKeyRef: null,
    ozonKeyRef: null,
    ozonClientId: null,
    
    totalProducts: 0,
    protectedProducts: 0,
    triggeredToday: 0,
    triggeredAllTime: 0,
    savedAmount: 0,
    
    createdAt: now,
    updatedAt: now,
    lastActiveAt: now,
    lastCheckedAt: null,
    
    betaFeatures: false,
    referralCode: generateReferralCode(telegramUser.id),
    referredBy: null,
  };
  
  await userRef.set(newUser);
  
  // Create referral entry
  await db.collection('referrals').doc(newUser.referralCode!).set({
    code: newUser.referralCode,
    ownerId: telegramUser.id,
    totalReferrals: 0,
    activeReferrals: 0,
    totalEarned: 0,
    commissionPercent: 20,
    createdAt: now,
  });
  
  // Log new user
  await createLogEntry(telegramUser.id, {
    type: 'info',
    title: 'Добро пожаловать!',
    message: `Пробный период активирован до ${trialExpiresAt.toLocaleDateString('ru-RU')}`,
  });
  
  return newUser;
}

// ============================================
// USER DATA RETRIEVAL
// ============================================

export async function getUserById(telegramId: number): Promise<User | null> {
  const userDoc = await db.collection('users').doc(telegramId.toString()).get();
  return userDoc.exists ? (userDoc.data() as User) : null;
}

export async function getUserWithStatus(telegramId: number): Promise<{
  user: User;
  isActive: boolean;
  daysLeft: number | null;
  limits: ReturnType<typeof checkPlanLimits>;
} | null> {
  const user = await getUserById(telegramId);
  if (!user) return null;
  
  return {
    user,
    isActive: isSubscriptionActive(user),
    daysLeft: getDaysUntilExpiry(user),
    limits: checkPlanLimits(user),
  };
}

// ============================================
// USER SETTINGS UPDATE
// ============================================

export async function updateUserSettings(
  telegramId: number,
  settings: Partial<Pick<User, 
    'protectionEnabled' | 
    'defenseMode' | 
    'alertsEnabled' | 
    'emailForAlerts' |
    'autoRenew'
  >>
): Promise<boolean> {
  const userRef = db.collection('users').doc(telegramId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) return false;
  
  const user = userDoc.data() as User;
  
  // Check if user can use selected defense mode
  if (settings.defenseMode) {
    const limits = checkPlanLimits(user);
    if (!limits.canUseDefenseMode(settings.defenseMode)) {
      return false;
    }
  }
  
  await userRef.update({
    ...settings,
    updatedAt: new Date(),
  });
  
  await createLogEntry(telegramId, {
    type: 'settings_changed',
    title: 'Настройки обновлены',
    message: 'Настройки защиты изменены',
    metadata: settings,
  });
  
  return true;
}

// ============================================
// SUBSCRIPTION MANAGEMENT
// ============================================

export async function checkExpiredSubscriptions(): Promise<void> {
  const now = new Date();
  
  // Find expired subscriptions
  const expiredUsers = await db.collection('users')
    .where('subscriptionActive', '==', true)
    .where('subscriptionExpiresAt', '<', now)
    .get();
  
  for (const doc of expiredUsers.docs) {
    const user = doc.data() as User;
    
    await doc.ref.update({
      subscriptionActive: false,
      protectionEnabled: false, // Disable protection
      updatedAt: now,
    });
    
    await createLogEntry(user.telegramId, {
      type: 'subscription_expired',
      title: 'Подписка истекла',
      message: 'Ваша подписка истекла. Продлите для продолжения защиты.',
    });
    
    // Send Telegram notification
    await sendExpiredNotification(user.telegramId);
  }
}

async function sendExpiredNotification(userId: number): Promise<void> {
  const botToken = process.env.TELEGRAM_BOT_TOKEN;
  if (!botToken) return;
  
  const axios = require('axios');
  
  try {
    await axios.post(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      chat_id: userId,
      text: `⚠️ <b>Подписка истекла</b>\n\nВаша защита отключена. Продлите подписку, чтобы продолжить защищать маржу.`,
      parse_mode: 'HTML',
      reply_markup: {
        inline_keyboard: [[
          { text: '💳 Продлить подписку', web_app: { url: process.env.WEBAPP_URL } },
        ]],
      },
    });
  } catch (error) {
    console.error('Failed to send expiry notification:', error);
  }
}

// ============================================
// REFERRAL SYSTEM
// ============================================

export async function applyReferralCode(
  userId: number, 
  referralCode: string
): Promise<{ success: boolean; error?: string }> {
  const userRef = db.collection('users').doc(userId.toString());
  const userDoc = await userRef.get();
  
  if (!userDoc.exists) {
    return { success: false, error: 'Пользователь не найден' };
  }
  
  const user = userDoc.data() as User;
  
  if (user.referredBy) {
    return { success: false, error: 'Вы уже использовали реферальный код' };
  }
  
  // Find referral
  const referralDoc = await db.collection('referrals').doc(referralCode.toUpperCase()).get();
  
  if (!referralDoc.exists) {
    return { success: false, error: 'Код не найден' };
  }
  
  const referral = referralDoc.data()!;
  
  // Can't refer yourself
  if (referral.ownerId === userId) {
    return { success: false, error: 'Нельзя использовать свой код' };
  }
  
  // Apply referral
  await userRef.update({
    referredBy: referral.ownerId,
    updatedAt: new Date(),
  });
  
  // Update referral stats
  await referralDoc.ref.update({
    totalReferrals: (referral.totalReferrals || 0) + 1,
  });
  
  return { success: true };
}

export async function getUserReferralStats(userId: number): Promise<{
  code: string;
  totalReferrals: number;
  activeReferrals: number;
  totalEarned: number;
  link: string;
} | null> {
  const user = await getUserById(userId);
  if (!user?.referralCode) return null;
  
  const referralDoc = await db.collection('referrals').doc(user.referralCode).get();
  if (!referralDoc.exists) return null;
  
  const referral = referralDoc.data()!;
  const botUsername = process.env.BOT_USERNAME || 'neuroguardian_bot';
  
  return {
    code: user.referralCode,
    totalReferrals: referral.totalReferrals || 0,
    activeReferrals: referral.activeReferrals || 0,
    totalEarned: referral.totalEarned || 0,
    link: `https://t.me/${botUsername}?start=${user.referralCode}`,
  };
}

// ============================================
// STATISTICS
// ============================================

export async function updateUserStats(
  userId: number,
  stats: Partial<Pick<User, 
    'totalProducts' | 
    'protectedProducts' | 
    'triggeredToday' | 
    'triggeredAllTime' |
    'savedAmount'
  >>
): Promise<void> {
  await db.collection('users').doc(userId.toString()).update({
    ...stats,
    updatedAt: new Date(),
  });
}

export async function resetDailyStats(): Promise<void> {
  // Reset triggeredToday for all users
  const batch = db.batch();
  const usersSnapshot = await db.collection('users').get();
  
  usersSnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { triggeredToday: 0 });
  });
  
  await batch.commit();
}

// ============================================
// LOGGING
// ============================================

export async function createLogEntry(
  userId: number,
  entry: Partial<LogEntry>
): Promise<string> {
  const logId = uuidv4();
  
  await db.collection('logs').doc(logId).set({
    id: logId,
    userId,
    type: entry.type || 'info',
    title: entry.title || '',
    message: entry.message || '',
    productId: entry.productId || null,
    transactionId: entry.transactionId || null,
    metadata: entry.metadata || {},
    read: false,
    createdAt: new Date(),
  });
  
  return logId;
}

export async function getUserLogs(
  userId: number,
  limit: number = 50
): Promise<LogEntry[]> {
  const logsSnapshot = await db.collection('logs')
    .where('userId', '==', userId)
    .orderBy('createdAt', 'desc')
    .limit(limit)
    .get();
  
  return logsSnapshot.docs.map((doc) => doc.data() as LogEntry);
}

export async function markLogsAsRead(userId: number): Promise<void> {
  const logsSnapshot = await db.collection('logs')
    .where('userId', '==', userId)
    .where('read', '==', false)
    .get();
  
  const batch = db.batch();
  logsSnapshot.docs.forEach((doc) => {
    batch.update(doc.ref, { read: true });
  });
  
  await batch.commit();
}

// ============================================
// HELPERS
// ============================================

function generateReferralCode(userId: number): string {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}
