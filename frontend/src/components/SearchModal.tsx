import React, { useState } from 'react';
import { X, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

interface SearchModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalEntries: number;
  onConfirm: (maxLeads: number, category: string) => void;
  isFetching: boolean;
  fetchResult: { success: boolean; total_saved: number } | null;
}

const SearchModal: React.FC<SearchModalProps> = ({ 
  isOpen, 
  onClose, 
  totalEntries, 
  onConfirm,
  isFetching,
  fetchResult
}) => {
  const [maxLeads, setMaxLeads] = useState<number>(Math.min(100, totalEntries));
  const [category, setCategory] = useState<string>('');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 backdrop-blur-sm p-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md overflow-hidden transform transition-all">
        <div className="p-6 border-b border-gray-100 flex justify-between items-center">
          <h3 className="text-xl font-bold text-gray-800">Lead Search Results</h3>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="p-6">
          {!fetchResult ? (
            <>
              <div className="flex items-center space-x-3 mb-6 p-4 bg-blue-50 rounded-xl border border-blue-100">
                <AlertCircle className="w-6 h-6 text-blue-600" />
                <div>
                  <p className="text-sm text-blue-800 font-medium">Matching Prospects Found</p>
                  <p className="text-2xl font-black text-blue-900">{totalEntries.toLocaleString()}</p>
                </div>
              </div>

              <div className="mb-4">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Max Leads to Import
                </label>
                <input
                  type="number"
                  value={maxLeads}
                  onChange={(e) => setMaxLeads(Math.min(parseInt(e.target.value) || 0, totalEntries))}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium"
                  min="1"
                  max={totalEntries}
                />
                <p className="text-xs text-gray-500 mt-2">
                  Credits will only be used for new leads imported.
                </p>
              </div>

              <div className="mb-6">
                <label className="block text-sm font-semibold text-gray-700 mb-2">
                  Category (optional)
                </label>
                <input
                  type="text"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                  placeholder="e.g. A, B, Vessel Side, Service Side"
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all text-lg font-medium"
                />
              </div>

              <button
                onClick={() => onConfirm(maxLeads, category)}
                disabled={isFetching || maxLeads <= 0}
                className="w-full bg-blue-600 text-white font-bold py-4 rounded-xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isFetching ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" />
                    <span>Importing Leads...</span>
                  </>
                ) : (
                  <span>Confirm Bulk Fetch</span>
                )}
              </button>
            </>
          ) : (
            <div className="text-center py-4">
              <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mb-4">
                <CheckCircle2 className="w-10 h-10 text-green-600" />
              </div>
              <h4 className="text-xl font-bold text-gray-800 mb-2">Import Successful!</h4>
              <p className="text-gray-600 mb-6">
                Successfully processed and saved <span className="font-bold text-green-600">{fetchResult.total_saved}</span> leads to your database.
              </p>
              <button
                onClick={onClose}
                className="w-full bg-gray-100 text-gray-800 font-bold py-3 rounded-xl hover:bg-gray-200 transition-colors"
              >
                Close
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default SearchModal;
