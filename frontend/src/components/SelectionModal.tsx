import React, { useState, useMemo, useEffect } from 'react';
import { X, Loader2, CheckCircle2, ShieldAlert, ChevronLeft, ChevronRight } from 'lucide-react';

interface LeadItem {
  apollo_id: string;
  contact_name: string;
  title: string;
  company: string;
  email?: string;
  category?: string;
}

interface SelectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  leads: LeadItem[];
  actionLabel: string;
  onAction: (ids: string[]) => Promise<{ processed: number } | void>;
}

const ITEMS_PER_PAGE = 50;

const SelectionModal: React.FC<SelectionModalProps> = ({ isOpen, onClose, title, leads, actionLabel, onAction }) => {
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [currentPage, setCurrentPage] = useState(1);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isFinished, setIsFinished] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [processed, setProcessed] = useState(0);
  const [categoryFilter, setCategoryFilter] = useState('');

  useEffect(() => {
    if (isOpen) {
      setSelectedIds(new Set(leads.map(l => l.apollo_id)));
      setCurrentPage(1);
      setIsFinished(false);
      setError(null);
      setProcessed(0);
      setCategoryFilter('');
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const availableCategories = useMemo(() => {
    const cats = leads.map(l => l.category).filter(Boolean) as string[];
    return Array.from(new Set(cats)).sort();
  }, [leads]);

  const filteredLeads = useMemo(() => {
    if (!categoryFilter) return leads;
    return leads.filter(l => l.category === categoryFilter);
  }, [leads, categoryFilter]);

  const totalPages = Math.ceil(filteredLeads.length / ITEMS_PER_PAGE);
  const startIdx = (currentPage - 1) * ITEMS_PER_PAGE;
  const pageLeads = filteredLeads.slice(startIdx, startIdx + ITEMS_PER_PAGE);
  const allSelected = filteredLeads.every(l => selectedIds.has(l.apollo_id));

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
      setSelectedIds(new Set(filteredLeads.map(l => l.apollo_id)));
    }
  };

  const handleAction = async () => {
    const selected = Array.from(selectedIds);
    if (selected.length === 0) return;
    setIsProcessing(true);
    setError(null);
    try {
      const result = await onAction(selected);
      setProcessed(result?.processed ?? selected.length);
      setIsFinished(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Operation failed');
      setIsFinished(false);
    } finally {
      setIsProcessing(false);
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

  if (isFinished) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
            <CheckCircle2 className="w-10 h-10 text-green-600" />
          </div>
          <h4 className="text-xl font-bold text-gray-800 mb-2">Complete!</h4>
          <p className="text-gray-600 mb-6">Processed {processed} leads.</p>
          <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl">Close</button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
        <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden p-8 text-center">
          <div className="mx-auto w-16 h-16 bg-red-50 rounded-full flex items-center justify-center mb-4">
            <ShieldAlert className="w-10 h-10 text-red-600" />
          </div>
          <h4 className="text-xl font-bold text-gray-800 mb-2">Error</h4>
          <p className="text-red-600 mb-6">{error}</p>
          <button onClick={onClose} className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl">Close</button>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <div className="bg-white w-full max-w-4xl rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[90vh]">
        <div className="px-6 py-5 border-b border-gray-100 flex justify-between items-center shrink-0">
          <div>
            <h3 className="text-xl font-bold text-gray-800">{title}</h3>
            <p className="text-sm text-gray-500 mt-1">
              {filteredLeads.length === leads.length
                ? `${leads.length} leads available`
                : `${filteredLeads.length} of ${leads.length} leads`}
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600"><X className="w-6 h-6" /></button>
        </div>

        <div className="px-6 py-3 border-b border-gray-100 shrink-0">
          <div className="flex items-center space-x-3">
            <select
              value={categoryFilter}
              onChange={e => { setCategoryFilter(e.target.value); setCurrentPage(1); }}
              className="px-3 py-2 border border-gray-300 rounded-lg text-xs font-bold text-gray-600 bg-white focus:ring-2 focus:ring-blue-500"
            >
              <option value="">All Categories</option>
              {availableCategories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <button onClick={toggleAll} className={`px-4 py-2 text-xs font-bold rounded-lg border transition-colors ${allSelected ? 'bg-blue-50 text-blue-700 border-blue-300' : 'bg-white text-gray-600 border-gray-300'}`}>
              {allSelected ? 'Deselect All' : `Select All (${filteredLeads.length})`}
            </button>
            <span className="text-xs text-gray-400">{selectedIds.size} selected</span>
          </div>
        </div>

        <div className="overflow-y-auto flex-1">
          <table className="w-full text-left">
            <thead className="bg-gray-50 sticky top-0">
              <tr className="border-b border-gray-100">
                <th className="px-4 py-3 w-10"></th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Name</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Title</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Company</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Email</th>
                <th className="px-4 py-3 text-xs font-bold text-gray-500 uppercase">Category</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {pageLeads.map(lead => (
                <tr key={lead.apollo_id} className="hover:bg-gray-50 cursor-pointer" onClick={() => toggleSelect(lead.apollo_id)}>
                  <td className="px-4 py-3">
                    <input type="checkbox" checked={selectedIds.has(lead.apollo_id)} onChange={() => toggleSelect(lead.apollo_id)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
                  </td>
                  <td className="px-4 py-3 text-sm font-bold text-gray-800">{lead.contact_name}</td>
                  <td className="px-4 py-3 text-sm text-gray-600 truncate max-w-[200px]">{lead.title}</td>
                  <td className="px-4 py-3 text-sm text-gray-700">{lead.company}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{lead.email || '—'}</td>
                  <td className="px-4 py-3">
                    {lead.category ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase">{lead.category}</span>
                    ) : (
                      <span className="text-xs text-gray-300">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {pageLeads.length === 0 && <div className="p-12 text-center text-gray-400 italic">No leads to display</div>}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 shrink-0">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-1">
              <button onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage <= 1} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronLeft className="w-4 h-4" /></button>
              {pageNumbers.map(p => (
                <button key={p} onClick={() => setCurrentPage(p)} className={`w-8 h-8 text-xs font-bold rounded-lg ${p === currentPage ? 'bg-blue-600 text-white' : 'text-gray-600 hover:bg-gray-100'}`}>{p}</button>
              ))}
              <button onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage >= totalPages} className="p-1 rounded hover:bg-gray-100 disabled:opacity-30"><ChevronRight className="w-4 h-4" /></button>
            </div>
            <button
              onClick={handleAction}
              disabled={selectedIds.size === 0 || isProcessing}
              className="px-6 py-2.5 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 disabled:opacity-50 flex items-center space-x-2"
            >
              {isProcessing ? <><Loader2 className="w-4 h-4 animate-spin" /><span>Processing...</span></> : <span>{actionLabel} ({selectedIds.size})</span>}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SelectionModal;
