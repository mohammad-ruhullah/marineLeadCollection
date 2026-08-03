import React, { useState, useEffect } from 'react';
import { X, CheckCircle2, Loader2, ChevronLeft, ChevronRight, Sparkles, AlertCircle } from 'lucide-react';

interface PreviewLead {
  apollo_id: string;
  name: string;
  title: string;
  company: string;
  country: string;
  is_marine: boolean;
  classification_source: string;
  description?: string;
}

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  previewData: {
    target: number;
    total_found: number;
    classifier: string;
    leads: PreviewLead[];
  } | null;
  onSave: (selectedLeads: PreviewLead[], category: string) => void;
  isSaving: boolean;
  saveResult: { success: boolean; total_saved: number } | null;
  existingCategories?: string[];
}

const ITEMS_PER_PAGE = 50;

const SearchModal: React.FC<SearchModalProps> = ({
  isOpen,
  onClose,
  previewData,
  onSave,
  isSaving,
  saveResult,
  existingCategories = []
}) => {
  const [category, setCategory] = useState('');
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);

  // Auto-select marine leads when preview opens
  useEffect(() => {
    if (previewData?.leads) {
      const marineIds = previewData.leads.filter(l => l.is_marine).map(l => l.apollo_id);
      setSelectedIds(new Set(marineIds));
      setCurrentPage(1);
    }
  }, [previewData]);

  if (!isOpen) return null;

  if (saveResult) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
        <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden">
          <div className="p-6 text-center">
            <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
              <CheckCircle2 className="w-10 h-10 text-green-600" />
            </div>
            <h4 className="text-xl font-bold text-gray-800 mb-2">Import Successful!</h4>
            <p className="text-gray-600 mb-6">
              Successfully saved <span className="font-bold text-green-600">{saveResult.total_saved}</span> leads to your database.
            </p>
            <button
              onClick={onClose}
              className="w-full bg-gray-100 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
            >
              Close
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (!previewData) return null;

  const leads = previewData.leads;
  const totalPages = Math.ceil(leads.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLeads = leads.slice(startIdx, startIdx + ITEMS_PER_PAGE);

  const allSelected = leads.every(l => selectedIds.has(l.apollo_id));

  const toggleSelect = (id: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleAll = () => {
    if (allSelected) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(leads.map(l => l.apollo_id)));
    }
  };

  const pageNumbers = [];
  const maxVisible = 5;
  let startPage = Math.max(1, currentPage - Math.floor(maxVisible / 2));
  let endPage = Math.min(totalPages, startPage + maxVisible - 1);
  if (endPage - startPage + 1 < maxVisible) {
    startPage = Math.max(1, endPage - maxVisible + 1);
  }
  for (let i = startPage; i <= endPage; i++) pageNumbers.push(i);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-800">Lead Preview</h3>
            <p className="text-sm text-gray-500 mt-1">
              {leads.length} new leads found
              {previewData.classifier === 'ai' ? (
                <span className="ml-2 inline-flex items-center text-xs text-blue-600 font-medium">
                  <Sparkles className="w-3 h-3 mr-1" />
                  Classified by Gemini AI
                </span>
              ) : (
                <span className="ml-2 inline-flex items-center text-xs text-amber-600 font-medium">
                  <AlertCircle className="w-3 h-3 mr-1" />
                  Classified by rules (AI unavailable)
                </span>
              )}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

            <div className="px-6 py-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center space-x-4">
            <div className="flex-1 max-w-xs">
              <label className="block text-xs font-semibold text-gray-700 mb-1">Category <span className="text-red-500">*</span></label>
              <input
                type="text"
                value={category}
                onChange={e => setCategory(e.target.value)}
                placeholder="Select or type: A, B..."
                list="category-options"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <datalist id="category-options">
                <option value="A" />
                <option value="B" />
                {existingCategories.filter(c => c !== 'A' && c !== 'B').map(c => (
                  <option key={c} value={c} />
                ))}
              </datalist>
            </div>
            <div className="flex items-center space-x-2 pt-5">
              <span className={`inline-flex items-center px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${
                allSelected
                  ? 'border-green-300 bg-green-50 text-green-700'
                  : 'border-gray-300 bg-gray-50 text-gray-500'
              }`}>
                Selected Marine ({selectedIds.size})
              </span>
              <button
                onClick={toggleAll}
                className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${
                  allSelected
                    ? 'bg-blue-50 text-blue-700 border-blue-300'
                    : 'bg-white text-gray-600 border-gray-300 hover:border-blue-300'
                }`}
              >
                {allSelected ? 'Deselect All' : `Select All (${leads.length})`}
              </button>
            </div>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 w-12 text-xs font-bold text-gray-500 uppercase tracking-wider">#</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Name</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Title</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Company</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Company Summary</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider">Country</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase tracking-wider text-right">Marine</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageLeads.map((lead, index) => (
                <tr
                  key={lead.apollo_id}
                  className={`hover:bg-gray-50 transition-colors cursor-pointer ${
                    lead.is_marine ? '' : 'opacity-80'
                  }`}
                  onClick={() => toggleSelect(lead.apollo_id)}
                >
                  <td className="px-4 py-3">
                    <input
                      type="checkbox"
                      checked={selectedIds.has(lead.apollo_id)}
                      onChange={() => toggleSelect(lead.apollo_id)}
                      className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                    />
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-400">
                    {(currentPage - 1) * ITEMS_PER_PAGE + index + 1}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm font-bold text-gray-800">{lead.name}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600 truncate max-w-[200px]">{lead.title}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-700">{lead.company}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-500 break-words">{lead.description || '—'}</div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-sm text-gray-600">{lead.country}</div>
                  </td>
                  <td className="px-4 py-3 text-right">
                    {lead.is_marine ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase">Marine</span>
                    ) : (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-500 uppercase">Non-Marine</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {pageLeads.length === 0 && (
            <div className="p-12 text-center text-gray-400 italic font-medium">
              No leads to display
            </div>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <p className="text-sm text-gray-500">
              <span className="font-bold text-gray-700">{selectedIds.size}</span> of {leads.length} selected
            </p>

            <div className="flex items-center space-x-2">
              <div className="flex items-center space-x-1 mr-4">
                <button
                  onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                  disabled={currentPage <= 1}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                {pageNumbers.map(p => (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`w-8 h-8 text-xs font-bold rounded-lg ${
                      p === currentPage
                        ? 'bg-blue-600 text-white'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
                  disabled={currentPage >= totalPages}
                  className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
              </div>

              <button
                onClick={() => {
                  if (!category.trim()) {
                    alert('Please select or create a category before saving.');
                    return;
                  }
                  onSave(leads.filter(l => selectedIds.has(l.apollo_id)), category);
                }}
                disabled={selectedIds.size === 0 || isSaving}
                className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md disabled:opacity-50 flex items-center space-x-2"
              >
                {isSaving ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Saving...</span>
                  </>
                ) : (
                  <span>Save Selected to Database ({selectedIds.size})</span>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
