import React from 'react';

export const SkeletonLine: React.FC<{ className?: string }> = ({ className = '' }) => (
  <div className={`skeleton-line ${className}`} />
);

export const SkeletonStats: React.FC<{ count?: number }> = ({ count = 4 }) => (
  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3" aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="skeleton-stat">
        <div className="flex items-start justify-between">
          <SkeletonLine className="w-16 h-3" />
          <div className="skeleton w-7 h-7 rounded-lg" />
        </div>
        <SkeletonLine className="w-10 h-6 mt-2" />
      </div>
    ))}
  </div>
);

export const SkeletonCards: React.FC<{ count?: number; className?: string }> = ({ count = 2, className = '' }) => (
  <div className={`space-y-3 ${className}`} aria-hidden="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card-soft p-4 space-y-2.5">
        <div className="flex items-center gap-2">
          <SkeletonLine className="w-28 h-4" />
          <div className="skeleton w-20 h-4 rounded-md" />
        </div>
        <SkeletonLine className="w-2/3" />
        <SkeletonLine className="w-1/2" />
      </div>
    ))}
  </div>
);

export const SkeletonPage: React.FC = () => (
  <div className="space-y-5" aria-hidden="true" aria-busy="true">
    <div className="card card-pad relative overflow-hidden">
      <SkeletonLine className="w-24 h-3" />
      <SkeletonLine className="w-48 h-6 mt-2.5" />
      <SkeletonLine className="w-64 h-3 mt-2" />
    </div>
    <SkeletonStats />
    <SkeletonCards count={3} />
  </div>
);

export const SkeletonGrid: React.FC<{ count?: number; cols?: string }> = ({ count = 4, cols = 'grid-cols-1 md:grid-cols-2' }) => (
  <div className={`grid ${cols} gap-3`} aria-hidden="true" aria-busy="true">
    {Array.from({ length: count }).map((_, i) => (
      <div key={i} className="card-soft p-4 space-y-3">
        <SkeletonLine className="w-1/2 h-4" />
        <SkeletonLine className="w-3/4" />
        <div className="skeleton h-24 rounded-xl" />
      </div>
    ))}
  </div>
);

export default SkeletonPage;
