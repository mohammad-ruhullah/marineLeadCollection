import React, { useState, useEffect, useCallback } from 'react';
import { apolloApi } from '../services/api';
import { X, ShieldCheck, AlertCircle, RefreshCw, CheckCircle2 } from 'lucide-react';

interface VerificationModalProps {
  isOpen: boolean;
  onClose: () => void;
  totalPending: number;
  onComplete: () => void;
}

const VerificationModal: React.FC<VerificationModalProps> = ({ isOpen, onClose, totalPending, onComplete }) => {
  const [processed, setProcessed] = useState(0);
  const [isFinished, setIsFinished] = useState(false);
  const [isVerifying, setIsVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const batchSize = 5;

  const runVerification = useCallback(async (currentProcessed: number) => {
    if (currentProcessed >= totalPending) {
      setIsFinished(true);
      setIsVerifying(false);
      onComplete();
      return;
    }

    setIsVerifying(true);
    setError(null);

    try {
      const result = await apolloApi.verifyLeads();
      
      if (result.success) {
        const nextProcessed = currentProcessed + (result.processed || 0);
        setProcessed(nextProcessed);
        
        // If we processed 0 but expected more, something might be stuck or out of sync
        if (result.processed === 0 && currentProcessed < totalPending) {
            // Check if there are actually any left
            setIsFinished(true);
            setIsVerifying(false);
            onComplete();
            return;
        }

        // Recursive call for next batch
        runVerification(nextProcessed);
      } else {
        throw new Error(result.message || 'Batch verification failed');
      }
    } catch (err: any) {
      console.error('Batch verification error:', err);
      const errorMsg = err.response?.data?.error || err.message || 'An unexpected error occurred';
      setError(errorMsg);
      setIsVerifying(false);
    }
  }, [totalPending, onComplete]);

  // Start verification when modal opens
  useEffect(() => {
    if (isOpen && !isFinished && !isVerifying && !error && processed === 0) {
      runVerification(0);
    }
  }, [isOpen, isFinished, isVerifying, error, processed, runVerification]);

  if (!isOpen) return null;

  const progress = Math.min(Math.round((processed / totalPending) * 100), 100);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm">
      <div className="bg-white w-full max-w-md rounded-3xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200">
        
        {/* Header */}
        <div className="px-6 py-6 border-b border-gray-100 flex justify-between items-center">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-50 rounded-lg text-blue-600">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <h3 className="text-xl font-bold text-gray-900">Email Verification</h3>
          </div>
          {!isVerifying && !isFinished && (
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
              <X className="w-6 h-6" />
            </button>
          )}
        </div>

        {/* Content */}
        <div className="p-8 text-center">
          {isFinished ? (
            <div className="animate-in zoom-in duration-500">
              <div className="w-20 h-20 bg-green-50 text-green-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <CheckCircle2 className="w-12 h-12" />
              </div>
              <h4 className="text-2xl font-black text-gray-900 mb-2">Process Complete!</h4>
              <p className="text-gray-500 mb-8">All {totalPending} leads have been verified through Hunter.io.</p>
              <button
                onClick={onClose}
                className="w-full py-4 bg-gray-900 text-white font-bold rounded-2xl hover:bg-black transition-all shadow-lg active:transform active:scale-95"
              >
                Close and View Results
              </button>
            </div>
          ) : error ? (
            <div className="animate-in fade-in duration-300">
              <div className="w-16 h-16 bg-red-50 text-red-600 rounded-full flex items-center justify-center mx-auto mb-6">
                <AlertCircle className="w-10 h-10" />
              </div>
              <h4 className="text-lg font-bold text-gray-900 mb-2">Something went wrong</h4>
              <div className="bg-red-50 p-4 rounded-xl mb-8">
                <p className="text-sm text-red-700 font-medium">{error}</p>
              </div>
              <div className="flex flex-col space-y-3">
                <button
                  onClick={() => runVerification(processed)}
                  className="w-full py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-lg flex items-center justify-center space-x-2"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>Retry Batch</span>
                </button>
                <button
                  onClick={onClose}
                  className="w-full py-4 bg-white text-gray-600 font-bold rounded-2xl border border-gray-200 hover:bg-gray-50 transition-all"
                >
                  Cancel and Close
                </button>
              </div>
            </div>
          ) : (
            <div>
              <p className="text-gray-600 mb-8 font-medium">
                Double-checking deliverability for your saved leads...
              </p>
              
              {/* Progress Ring / Bar Area */}
              <div className="relative pt-1">
                <div className="flex mb-4 items-center justify-between">
                  <div>
                    <span className="text-xs font-black inline-block py-1 px-2 uppercase rounded-full text-blue-600 bg-blue-50">
                      Progress
                    </span>
                  </div>
                  <div className="text-right">
                    <span className="text-sm font-black text-gray-900">
                      {processed} / {totalPending}
                    </span>
                  </div>
                </div>
                
                {/* Progress Bar Container */}
                <div className="overflow-hidden h-4 mb-4 text-xs flex rounded-full bg-gray-100 border border-gray-50">
                  <div 
                    style={{ width: `${progress}%` }}
                    className="shadow-none flex flex-col text-center whitespace-nowrap text-white justify-center bg-blue-600 transition-all duration-500 ease-out"
                  ></div>
                </div>
                
                <div className="flex items-center justify-center space-x-2 text-blue-600">
                    <RefreshCw className="w-4 h-4 animate-spin" />
                    <span className="text-sm font-bold">Verifying leads in batches of {batchSize}...</span>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default VerificationModal;
