import React, { useState, useMemo } from 'react';
import { Search, Filter, X, Check, ChevronDown } from 'lucide-react';

export interface FilterOption {
  label: string;
  value: string;
}

export interface FilterConfig<T> {
  key: keyof T;
  label: string;
  options: FilterOption[];
}

export interface EntitySearchSelectProps<T> {
  title?: string;
  items: T[];
  selectedId?: string | null;
  onSelect: (item: T | null) => void;
  idKey: keyof T;
  searchKeys: (keyof T)[];
  filterConfigs?: FilterConfig<T>[];
  renderItem: (item: T, isSelected: boolean) => React.ReactNode;
  placeholder?: string;
  emptyMessage?: string;
  className?: string;
  maxHeight?: string;
}

export function EntitySearchSelect<T extends Record<string, any>>({
  title,
  items,
  selectedId,
  onSelect,
  idKey,
  searchKeys,
  filterConfigs = [],
  renderItem,
  placeholder = 'Search by ID, code, name or keyword...',
  emptyMessage = 'No matching records found.',
  className = '',
  maxHeight = 'max-h-80',
}: EntitySearchSelectProps<T>) {
  const [searchQuery, setSearchQuery] = useState('');
  const [activeFilters, setActiveFilters] = useState<Record<string, string>>({});

  const handleFilterChange = (filterKey: string, value: string) => {
    setActiveFilters((prev) => {
      const next = { ...prev };
      if (!value || value === 'ALL') {
        delete next[filterKey];
      } else {
        next[filterKey] = value;
      }
      return next;
    });
  };

  const handleClearFilters = () => {
    setActiveFilters({});
    setSearchQuery('');
  };

  const hasActiveFilters = Object.keys(activeFilters).length > 0 || Boolean(searchQuery.trim());

  // Filter + Search Pipeline (Updates 12 Section 13: Order is Filter ➔ Search ➔ Results)
  const filteredItems = useMemo(() => {
    return items.filter((item) => {
      // 1. Apply multi-facet category filters
      for (const [fKey, fVal] of Object.entries(activeFilters)) {
        if (!fVal || fVal === 'ALL') continue;
        const itemVal = item[fKey];
        if (itemVal === undefined || itemVal === null) return false;
        if (String(itemVal).toLowerCase() !== String(fVal).toLowerCase()) {
          return false;
        }
      }

      // 2. Apply search query across searchKeys
      if (searchQuery.trim()) {
        const queryLower = searchQuery.toLowerCase().trim();
        const matchesQuery = searchKeys.some((k) => {
          const val = item[k];
          if (val === undefined || val === null) return false;
          return String(val).toLowerCase().includes(queryLower);
        });
        if (!matchesQuery) return false;
      }

      return true;
    });
  }, [items, activeFilters, searchQuery, searchKeys]);

  const selectedItem = useMemo(() => {
    if (!selectedId) return null;
    return items.find((i) => String(i[idKey]) === String(selectedId)) || null;
  }, [items, selectedId, idKey]);

  return (
    <div className={`bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden text-xs ${className}`}>
      {/* Optional Header */}
      {title && (
        <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
          <div className="font-bold text-slate-800 flex items-center gap-2">
            <span>{title}</span>
            <span className="px-2 py-0.5 rounded-full bg-slate-200 text-slate-700 text-[10px] font-extrabold">
              {filteredItems.length} of {items.length}
            </span>
          </div>

          {selectedItem && (
            <button
              type="button"
              onClick={() => onSelect(null)}
              className="text-[11px] font-bold text-rose-600 hover:text-rose-800 flex items-center gap-1 cursor-pointer"
            >
              <X className="w-3 h-3" />
              <span>Clear Selection</span>
            </button>
          )}
        </div>
      )}

      {/* Control Bar: FILTER ➔ SEARCH */}
      <div className="p-3.5 bg-slate-50/50 border-b border-slate-100 space-y-3">
        {/* Facet Filters */}
        {filterConfigs.length > 0 && (
          <div className="flex flex-wrap items-center gap-2">
            <div className="flex items-center gap-1 text-[11px] font-bold text-slate-500 mr-1">
              <Filter className="w-3.5 h-3.5 text-blue-600" />
              <span>Filter:</span>
            </div>

            {filterConfigs.map((fc) => (
              <div key={String(fc.key)} className="relative">
                <select
                  value={activeFilters[String(fc.key)] || 'ALL'}
                  onChange={(e) => handleFilterChange(String(fc.key), e.target.value)}
                  className="pl-2.5 pr-7 py-1.5 bg-white border border-slate-200 rounded-lg text-xs font-semibold text-slate-700 hover:border-slate-300 focus:outline-hidden focus:border-blue-500 shadow-2xs appearance-none cursor-pointer"
                >
                  <option value="ALL">All {fc.label}</option>
                  {fc.options.map((opt) => (
                    <option key={opt.value} value={opt.value}>
                      {opt.label}
                    </option>
                  ))}
                </select>
                <ChevronDown className="w-3 h-3 text-slate-400 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none" />
              </div>
            ))}

            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="px-2.5 py-1.5 rounded-lg bg-slate-200/80 hover:bg-slate-300 text-slate-700 text-[11px] font-bold transition-colors flex items-center gap-1 cursor-pointer"
                title="Reset all search queries and filters"
              >
                <X className="w-3 h-3" />
                <span>Reset</span>
              </button>
            )}
          </div>
        )}

        {/* Live Search Bar */}
        <div className="relative">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder={placeholder}
            className="w-full pl-9 pr-8 py-2 bg-white border border-slate-200 rounded-xl text-xs text-slate-800 placeholder-slate-400 focus:outline-hidden focus:border-blue-500 font-medium shadow-2xs"
          />
          {searchQuery && (
            <button
              type="button"
              onClick={() => setSearchQuery('')}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600 p-1"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* Results List */}
      <div className={`overflow-y-auto divide-y divide-slate-100 ${maxHeight}`}>
        {filteredItems.length === 0 ? (
          <div className="p-8 text-center text-slate-400 space-y-1">
            <Search className="w-6 h-6 mx-auto mb-1 text-slate-300" />
            <p className="font-semibold">{emptyMessage}</p>
            {hasActiveFilters && (
              <button
                type="button"
                onClick={handleClearFilters}
                className="text-[11px] font-bold text-blue-600 hover:underline mt-2 inline-block cursor-pointer"
              >
                Clear active filters & search query
              </button>
            )}
          </div>
        ) : (
          filteredItems.map((item) => {
            const isSelected = String(item[idKey]) === String(selectedId);
            return (
              <div
                key={String(item[idKey])}
                onClick={() => onSelect(isSelected ? null : item)}
                className={`p-3 transition-colors cursor-pointer flex items-center justify-between gap-3 ${
                  isSelected
                    ? 'bg-blue-50/80 hover:bg-blue-100/60 border-l-4 border-blue-600'
                    : 'hover:bg-slate-50'
                }`}
              >
                <div className="flex-1 min-w-0">{renderItem(item, isSelected)}</div>
                <div
                  className={`w-5 h-5 rounded-md border flex items-center justify-center shrink-0 ${
                    isSelected
                      ? 'border-blue-600 bg-blue-600 text-white'
                      : 'border-slate-300 bg-white text-transparent'
                  }`}
                >
                  <Check className="w-3.5 h-3.5" />
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
export default EntitySearchSelect;
