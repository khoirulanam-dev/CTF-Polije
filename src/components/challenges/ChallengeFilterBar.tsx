import React from 'react';
import APP from '@/config';
import { motion } from 'framer-motion';

type Props = {
  filters: {
    status?: string;
    category: string;
    difficulty: string;
    search: string;
  };
  categories: string[];
  difficulties: string[];
  onFilterChange: (filters: any) => void;
  onClear: () => void;
  showStatusFilter?: boolean;
};

export default function ChallengeFilterBar({
  filters,
  categories,
  difficulties,
  onFilterChange,
  onClear,
  showStatusFilter = true,
}: Props) {
  // Ambil urutan dari config
  const categoryOrder = APP.challengeCategories || [];
  const difficultyOrder = Object.keys(APP.difficultyStyles || {});

  // Sort categories sesuai order di config
  const sortedCategories = [
    ...categoryOrder.filter(cat => categories.includes(cat)),
    ...categories.filter(cat => !categoryOrder.includes(cat))
  ];

  // Normalize difficulties ke format config (capitalize)
  const capitalize = (str: string) => str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
  const normalizedDifficulties = Array.from(new Set(difficulties.map(capitalize)));
  const sortedDifficulties = [
    ...difficultyOrder.filter(diff => normalizedDifficulties.includes(diff)),
    ...normalizedDifficulties.filter(diff => !difficultyOrder.includes(diff))
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="w-full bg-white dark:bg-slate-900/60 rounded-2xl shadow-sm border border-slate-200 dark:border-slate-800/80 p-3.5 sm:p-4 mb-0"
    >
      <form className="w-full flex flex-wrap gap-3 items-center">
        <label htmlFor="search" className="sr-only">Search challenges</label>
        <div className="flex-1 min-w-[180px]">
          <input
            id="search"
            type="text"
            value={filters.search}
            onChange={e => onFilterChange({ ...filters, search: e.target.value })}
            placeholder="🔍 Cari challenge..."
            className="w-full px-3.5 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 transition"
          />
        </div>

        {showStatusFilter && (
          <div className="flex-1 min-w-[140px]">
            <label htmlFor="status" className="sr-only">Status</label>
            <select
              id="status"
              value={filters.status || 'all'}
              onChange={e => onFilterChange({ ...filters, status: e.target.value })}
              className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 cursor-pointer transition"
            >
              <option value="all">All Status</option>
              <option value="unsolved">Unsolved</option>
              <option value="solved">Solved</option>
            </select>
          </div>
        )}

        <div className="flex-1 min-w-[140px]">
          <label htmlFor="category" className="sr-only">Category</label>
          <select
            id="category"
            value={filters.category}
            onChange={e => onFilterChange({ ...filters, category: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 cursor-pointer transition"
          >
            <option value="all">All Categories</option>
            {sortedCategories.map(category => (
              <option key={category} value={category}>{category}</option>
            ))}
          </select>
        </div>

        <div className="flex-1 min-w-[140px]">
          <label htmlFor="difficulty" className="sr-only">Difficulty</label>
          <select
            id="difficulty"
            value={filters.difficulty}
            onChange={e => onFilterChange({ ...filters, difficulty: e.target.value })}
            className="w-full px-3 py-2 text-sm border border-slate-200 dark:border-slate-800 rounded-xl bg-slate-50 dark:bg-slate-900/80 text-slate-900 dark:text-slate-100 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500/30 cursor-pointer transition"
          >
            <option value="all">All Difficulties</option>
            {sortedDifficulties.map(difficulty => (
              <option key={difficulty} value={difficulty}>{difficulty}</option>
            ))}
          </select>
        </div>

        <div className="flex-none min-w-[90px]">
          <button
            type="button"
            onClick={onClear}
            className="w-full px-4 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 hover:bg-slate-200 dark:bg-slate-800/80 dark:hover:bg-slate-700/80 hover:text-slate-900 dark:hover:text-white border border-slate-200 dark:border-slate-700/60 rounded-xl transition shadow-xs"
            aria-label="Clear filters"
          >
            Clear
          </button>
        </div>
      </form>
    </motion.div>
  );
}
