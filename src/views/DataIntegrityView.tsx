import React, { useState } from 'react';
import { useGrid } from '../context/GridContext';
import { DataQualityIssue } from '../types/grid';
import { SourceBadge } from '../components/ui/SourceBadge';
import { formatMissingValue } from '../services/syntheticData';
import {
  Database,
  AlertTriangle,
  CheckCircle2,
  Search,
  Filter,
  ShieldCheck,
  Check,
  MapPin,
  Network,
  SearchCheck
} from 'lucide-react';

export const DataIntegrityView: React.FC = () => {
  const {
    scopedIssues,
    resolveIssue,
    scopedStats,
    geoScopeLabel,
    hasRegionSelection,
    resetGeoFilter,
    selectedAssetId,
    selectAsset,
    focusAssetOnMap,
    openKnowledgeGraphForAsset,
    openRootCauseForAsset
  } = useGrid();
  const [selectedIssue, setSelectedIssue] = useState<DataQualityIssue | null>(null);
  const [chosenValue, setChosenValue] = useState<string>('');
  const [resolutionNotes, setResolutionNotes] = useState<string>('');
  const [filterType, setFilterType] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');

  const filteredIssues = scopedIssues.filter((issue) => {
    const matchesFilter = filterType === 'ALL' || issue.status === filterType;
    const matchesSearch =
      issue.canonicalAssetId.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.assetName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      issue.explanation.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleOpenResolveModal = (issue: DataQualityIssue) => {
    setSelectedIssue(issue);
    setChosenValue(issue.conflictingValueA);
    setResolutionNotes(
      `Verified canonical identifier ${issue.canonicalAssetId} (${issue.assetName}).`
    );
  };

  const handleConfirmResolution = () => {
    if (!selectedIssue) return;
    resolveIssue(selectedIssue.id, chosenValue, resolutionNotes);
    setSelectedIssue(null);
  };

  return (
    <div className="space-y-6 max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <Database className="w-5 h-5 text-cyan-600 dark:text-cyan-400" />
            <h2 className="text-lg font-bold text-slate-900 dark:text-white">
              Module 1: GridData Integrity Engine
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            Reconciles cross-system identifier mismatches and audits unmapped OpenStreetMap attributes using canonical IDs.
          </p>
        </div>

        <div className="flex items-center gap-3">
          {hasRegionSelection && (
            <button
              type="button"
              onClick={resetGeoFilter}
              className="px-2.5 py-1 text-[11px] font-mono text-cyan-600 dark:text-cyan-400 bg-cyan-500/10 border border-cyan-500/30 rounded-lg hover:bg-cyan-500/20 transition-colors"
            >
              Scope: {geoScopeLabel} (Clear)
            </button>
          )}
          <div className="text-right">
            <span className="text-[11px] font-mono text-slate-400 block">Integrity Score</span>
            <span className="text-base font-bold font-mono text-emerald-600 dark:text-emerald-400 tabular-nums">
              {scopedStats.dataQualityScore}%
            </span>
          </div>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl overflow-hidden space-y-3">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search canonical ID, name, or conflict..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 placeholder-slate-400 focus:outline-none focus:ring-1 focus:ring-cyan-500 w-64"
              />
            </div>

            <div className="flex items-center gap-1 bg-slate-100 dark:bg-slate-800 p-0.5 rounded-lg text-xs">
              <Filter className="w-3.5 h-3.5 text-slate-400 ml-1.5" />
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value)}
                className="bg-transparent text-slate-700 dark:text-slate-200 pr-2 py-1 text-xs focus:outline-none cursor-pointer"
              >
                <option value="ALL">All Statuses</option>
                <option value="DETECTED">Detected</option>
                <option value="UNDER_REVIEW">Under Review</option>
                <option value="RESOLVED">Resolved</option>
              </select>
            </div>
          </div>

          <span className="text-xs font-mono text-slate-500 dark:text-slate-400 tabular-nums">
            Showing {filteredIssues.length} of {scopedIssues.length} finding(s)
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 dark:bg-slate-800/40 text-slate-500 dark:text-slate-400 font-mono border-b border-slate-200 dark:border-slate-800">
              <tr>
                <th className="py-2.5 px-4 font-semibold">CANONICAL ASSET</th>
                <th className="py-2.5 px-4 font-semibold">SOURCE</th>
                <th className="py-2.5 px-4 font-semibold">ISSUE TYPE</th>
                <th className="py-2.5 px-4 font-semibold">SYSTEM A</th>
                <th className="py-2.5 px-4 font-semibold">SYSTEM B</th>
                <th className="py-2.5 px-4 font-semibold">STATUS</th>
                <th className="py-2.5 px-4 font-semibold text-right">ACTION</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-800">
              {filteredIssues.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 px-4 text-center text-xs text-slate-500 dark:text-slate-400">
                    No data integrity findings in the active scope.
                  </td>
                </tr>
              ) : (
                filteredIssues.map((issue) => {
                  const isResolved = issue.status === 'RESOLVED';
                  const isSelected = selectedAssetId === issue.canonicalAssetId;
                  return (
                    <tr
                      key={issue.id}
                      onClick={() =>
                        selectAsset(issue.canonicalAssetId, 'integrity', {
                          zoom: 15,
                          openPopup: false
                        })
                      }
                      className={`cursor-pointer transition-colors ${
                        isSelected
                          ? 'bg-cyan-500/10 dark:bg-cyan-500/10'
                          : 'hover:bg-slate-50 dark:hover:bg-slate-800/30'
                      }`}
                    >
                      <td className="py-3 px-4 font-mono font-medium text-slate-900 dark:text-white">
                        <div>{issue.canonicalAssetId}</div>
                        <div className="text-[11px] font-sans text-slate-500 dark:text-slate-400">
                          {formatMissingValue(issue.assetName)}
                        </div>
                      </td>

                      <td className="py-3 px-4">
                        <SourceBadge source={issue.source} compact />
                      </td>

                      <td className="py-3 px-4">
                        <span
                          className={`inline-flex items-center gap-1 font-mono text-[11px] font-medium ${
                            issue.severity === 'CRITICAL'
                              ? 'text-rose-600 dark:text-rose-400'
                              : 'text-amber-600 dark:text-amber-400'
                          }`}
                        >
                          <AlertTriangle className="w-3 h-3" />
                          {issue.issueType}
                        </span>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <div className="text-[10px] text-slate-400 font-sans">
                          {issue.conflictingSourceA}
                        </div>
                        <div className="font-semibold">{formatMissingValue(issue.conflictingValueA)}</div>
                      </td>

                      <td className="py-3 px-4 font-mono text-[11px] text-slate-700 dark:text-slate-300">
                        <div className="text-[10px] text-slate-400 font-sans">
                          {issue.conflictingSourceB}
                        </div>
                        <div className="font-semibold">{formatMissingValue(issue.conflictingValueB)}</div>
                      </td>

                      <td className="py-3 px-4">
                        {isResolved ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                            <CheckCircle2 className="w-3 h-3" />
                            Resolved ({issue.chosenCanonicalValue})
                          </span>
                        ) : (
                          <span className="text-[11px] font-mono font-medium text-amber-600 dark:text-amber-400">
                            {issue.status}
                          </span>
                        )}
                      </td>

                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        <div className="inline-flex items-center justify-end gap-2">
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              focusAssetOnMap(issue.canonicalAssetId);
                            }}
                            className="px-2 py-1 text-xs text-cyan-600 dark:text-cyan-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <MapPin className="w-3 h-3" />
                            <span>Map</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openKnowledgeGraphForAsset(issue.canonicalAssetId);
                            }}
                            className="px-2 py-1 text-xs text-indigo-600 dark:text-indigo-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <Network className="w-3 h-3" />
                            <span>Graph</span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              openRootCauseForAsset(issue.canonicalAssetId);
                            }}
                            className="px-2 py-1 text-xs text-amber-600 dark:text-amber-400 hover:underline inline-flex items-center gap-1 whitespace-nowrap shrink-0"
                          >
                            <SearchCheck className="w-3 h-3" />
                            <span>RCA</span>
                          </button>
                          {isResolved ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenResolveModal(issue);
                              }}
                              className="px-2.5 py-1 text-xs text-slate-600 dark:text-slate-400 hover:text-slate-900 dark:hover:text-white underline whitespace-nowrap shrink-0"
                            >
                              View Audit Note
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenResolveModal(issue);
                              }}
                              className="px-3 py-1 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-md transition-colors whitespace-nowrap shrink-0"
                            >
                              Reconcile
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {selectedIssue && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl max-w-2xl w-full p-6 space-y-5 shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 dark:border-slate-800 pb-3">
              <div>
                <h3 className="text-sm font-bold text-slate-900 dark:text-white flex items-center gap-2">
                  <ShieldCheck className="w-4 h-4 text-cyan-500" />
                  <span>Reconcile Integrity Finding: {selectedIssue.canonicalAssetId}</span>
                  <SourceBadge source={selectedIssue.source} compact />
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Verified attribute decisions are recorded in the immutable audit trail.
                </p>
              </div>
              <button
                onClick={() => setSelectedIssue(null)}
                className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 text-sm font-mono"
              >
                ✕
              </button>
            </div>

            <div className="p-3 bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800/40 rounded-xl text-xs text-slate-700 dark:text-slate-300 leading-relaxed">
              <strong>Context:</strong> {selectedIssue.explanation}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div
                onClick={() => setChosenValue(selectedIssue.conflictingValueA)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  chosenValue === selectedIssue.conflictingValueA
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                    {selectedIssue.conflictingSourceA}
                  </span>
                  {chosenValue === selectedIssue.conflictingValueA && (
                    <Check className="w-3.5 h-3.5 text-cyan-500" />
                  )}
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {formatMissingValue(selectedIssue.conflictingValueA)}
                </div>
              </div>

              <div
                onClick={() => setChosenValue(selectedIssue.conflictingValueB)}
                className={`p-4 rounded-xl border cursor-pointer transition-all ${
                  chosenValue === selectedIssue.conflictingValueB
                    ? 'border-cyan-500 bg-cyan-500/10 ring-1 ring-cyan-500'
                    : 'border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-800/40'
                }`}
              >
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[10px] font-mono uppercase text-slate-500 dark:text-slate-400">
                    {selectedIssue.conflictingSourceB}
                  </span>
                  {chosenValue === selectedIssue.conflictingValueB && (
                    <Check className="w-3.5 h-3.5 text-cyan-500" />
                  )}
                </div>
                <div className="text-sm font-bold font-mono text-slate-900 dark:text-white">
                  {formatMissingValue(selectedIssue.conflictingValueB)}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-900 dark:text-white">
                Engineering Verification Note:
              </label>
              <textarea
                rows={3}
                value={resolutionNotes}
                onChange={(e) => setResolutionNotes(e.target.value)}
                className="w-full text-xs p-3 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-900 dark:text-slate-100 focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>

            <div className="flex items-center justify-end gap-3 pt-2 border-t border-slate-200 dark:border-slate-800">
              <button
                onClick={() => setSelectedIssue(null)}
                className="px-4 py-2 text-xs font-medium text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleConfirmResolution}
                className="px-4 py-2 text-xs font-semibold text-white bg-cyan-600 hover:bg-cyan-500 rounded-lg transition-colors shadow-sm"
              >
                Confirm Canonical Record
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
