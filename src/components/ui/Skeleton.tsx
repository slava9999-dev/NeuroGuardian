// ============================================
// NeuroGUARDIAN — Skeleton Loading Components
// Warm Light Theme V7.0
// ============================================

import { motion } from 'framer-motion';

interface SkeletonProps {
  className?: string;
}

// Base skeleton component with shimmer animation
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <motion.div
      initial={{ opacity: 0.5 }}
      animate={{ opacity: [0.5, 0.8, 0.5] }}
      transition={{ duration: 1.5, repeat: Infinity, ease: 'easeInOut' }}
      className={`bg-surface-hl rounded-lg ${className}`}
    />
  );
}

// Product card skeleton
export function ProductCardSkeleton() {
  return (
    <div className="card overflow-hidden">
      <div className="flex gap-4 p-4">
        {/* Image skeleton */}
        <Skeleton className="w-24 h-24 sm:w-28 sm:h-28 shrink-0 rounded-xl" />

        {/* Content skeleton */}
        <div className="flex-1 min-w-0">
          {/* Status badge */}
          <div className="flex gap-2 mb-2">
            <Skeleton className="h-5 w-20 rounded-full" />
            <Skeleton className="h-5 w-16 rounded" />
          </div>

          {/* Title */}
          <Skeleton className="h-4 w-full mb-2 rounded" />
          <Skeleton className="h-4 w-3/4 mb-3 rounded" />

          {/* Price */}
          <div className="flex items-center gap-3">
            <Skeleton className="h-7 w-24 rounded" />
            <Skeleton className="h-5 w-12 rounded" />
          </div>
        </div>
      </div>

      {/* Economics section */}
      <div className="px-4 pb-3">
        <div className="grid grid-cols-2 gap-3 p-3 bg-surface-warm rounded-xl">
          <div>
            <Skeleton className="h-3 w-20 mb-2 rounded" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
          <div>
            <Skeleton className="h-3 w-16 mb-2 rounded" />
            <Skeleton className="h-9 w-full rounded-lg" />
          </div>
        </div>
      </div>

      {/* Actions */}
      <div className="px-4 pb-4 flex gap-2">
        <Skeleton className="flex-1 h-11 rounded-lg" />
        <Skeleton className="h-11 w-11 rounded-lg" />
        <Skeleton className="h-11 w-11 rounded-lg" />
      </div>
    </div>
  );
}

// Products page skeleton
export function ProductsPageSkeleton() {
  return (
    <div className="space-y-4 p-5">
      {/* Header skeleton */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-6 w-32 rounded" />
        </div>
        <Skeleton className="h-10 w-10 rounded-xl" />
      </div>

      {/* Search bar */}
      <Skeleton className="h-12 w-full rounded-xl mb-6" />

      {/* Product cards */}
      {[1, 2, 3].map(i => (
        <ProductCardSkeleton key={i} />
      ))}
    </div>
  );
}

// Chat message skeleton
export function MessageSkeleton({ isUser = false }: { isUser?: boolean }) {
  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className={`flex ${isUser ? 'justify-end' : 'justify-start'}`}
    >
      <div className={`max-w-[85%] ${isUser ? 'items-end' : 'items-start'}`}>
        <Skeleton
          className={`h-14 rounded-2xl ${isUser ? 'w-48 rounded-br-md' : 'w-64 rounded-bl-md'}`}
        />
        <Skeleton className="h-3 w-12 mt-1.5 rounded" />
      </div>
    </motion.div>
  );
}

// Settings section skeleton
export function SettingsSectionSkeleton() {
  return (
    <div className="space-y-4">
      <Skeleton className="h-4 w-32 mb-4 rounded" />
      <div className="card p-4 space-y-4">
        <div className="flex items-center gap-4">
          <Skeleton className="h-12 w-12 rounded-xl" />
          <div className="flex-1">
            <Skeleton className="h-4 w-32 mb-2 rounded" />
            <Skeleton className="h-3 w-24 rounded" />
          </div>
          <Skeleton className="h-8 w-16 rounded-lg" />
        </div>
      </div>
    </div>
  );
}

// Account card skeleton
export function AccountCardSkeleton() {
  return (
    <div className="card p-4 flex items-center justify-between">
      <div className="flex items-center gap-4">
        <Skeleton className="w-12 h-12 rounded-xl" />
        <div>
          <Skeleton className="h-4 w-28 mb-2 rounded" />
          <div className="flex gap-2">
            <Skeleton className="h-5 w-16 rounded-full" />
            <Skeleton className="h-5 w-20 rounded" />
          </div>
        </div>
      </div>
      <div className="flex gap-2">
        <Skeleton className="h-8 w-8 rounded-lg" />
        <Skeleton className="h-8 w-8 rounded-lg" />
      </div>
    </div>
  );
}

// Dashboard stats skeleton
export function DashboardStatsSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-3">
      {[1, 2, 3, 4].map(i => (
        <div key={i} className="card p-4">
          <Skeleton className="h-3 w-16 mb-2 rounded" />
          <Skeleton className="h-8 w-20 mb-1 rounded" />
          <Skeleton className="h-3 w-12 rounded" />
        </div>
      ))}
    </div>
  );
}

// Full page loading skeleton
export function PageLoadingSkeleton() {
  return (
    <div className="min-h-full bg-page px-5 py-6 pb-32">
      {/* Header */}
      <div className="flex items-center gap-4 mb-8">
        <Skeleton className="h-10 w-10 rounded-xl" />
        <div>
          <Skeleton className="h-6 w-40 mb-1 rounded" />
          <Skeleton className="h-3 w-24 rounded" />
        </div>
      </div>

      {/* Content sections */}
      <div className="space-y-6">
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
        <SettingsSectionSkeleton />
      </div>
    </div>
  );
}

// Subscription card skeleton
export function SubscriptionCardSkeleton() {
  return (
    <div className="card p-5">
      <div className="flex items-center gap-3 mb-4">
        <Skeleton className="w-10 h-10 rounded-xl" />
        <div>
          <Skeleton className="h-3 w-16 mb-1 rounded" />
          <Skeleton className="h-5 w-24 rounded" />
        </div>
      </div>
      <Skeleton className="h-10 w-full rounded-lg" />
    </div>
  );
}

// Agent welcome skeleton
export function AgentWelcomeSkeleton() {
  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 pb-32">
      {/* Avatar */}
      <Skeleton className="w-32 h-32 rounded-2xl mb-10" />

      {/* Text */}
      <div className="text-center space-y-3 mb-10 w-full max-w-sm">
        <Skeleton className="h-3 w-32 mx-auto rounded" />
        <Skeleton className="h-8 w-48 mx-auto rounded" />
        <Skeleton className="h-4 w-64 mx-auto rounded" />
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-2 gap-3 w-full max-w-sm">
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
        <Skeleton className="h-16 rounded-xl" />
      </div>
    </div>
  );
}

// Export all for easy access
export const Skeletons = {
  Base: Skeleton,
  ProductCard: ProductCardSkeleton,
  ProductsPage: ProductsPageSkeleton,
  Message: MessageSkeleton,
  SettingsSection: SettingsSectionSkeleton,
  AccountCard: AccountCardSkeleton,
  DashboardStats: DashboardStatsSkeleton,
  PageLoading: PageLoadingSkeleton,
  SubscriptionCard: SubscriptionCardSkeleton,
  AgentWelcome: AgentWelcomeSkeleton,
};

export default Skeletons;
