import React, { useEffect, useState } from 'react';
import { apolloApi } from '../services/api';
import { RefreshCw, Zap } from 'lucide-react';

interface CreditData {
  total: number;
  used: number;
  remaining: number;
}

const Header: React.FC = () => {
  const [credits, setCredits] = useState<CreditData | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchCredits = async () => {
    setLoading(true);
    try {
      const data = await apolloApi.getCredits();
      setCredits(data);
    } catch (error) {
      console.error('Error fetching credits:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCredits();
  }, []);

  const usagePercentage = credits ? (credits.used / credits.total) * 100 : 0;

  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-2">
        <Zap className="text-blue-600 w-8 h-8" />
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          ShipParts <span className="text-blue-600">LeadGen</span>
        </h1>
      </div>

      <div className="flex items-center space-x-6">
        <div className="flex flex-col items-end w-64">
          <div className="flex justify-between w-full mb-1 text-xs font-medium text-gray-600">
            <span>API Credit Usage</span>
            {credits && typeof credits.used === 'number' && typeof credits.total === 'number' && (
              <span>
                {credits.used.toLocaleString()} / {credits.total.toLocaleString()}
              </span>
            )}
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2.5">
            <div
              className="bg-blue-600 h-2.5 rounded-full transition-all duration-500"
              style={{ width: `${credits && credits.total > 0 ? Math.min(usagePercentage, 100) : 0}%` }}
            ></div>
          </div>
        </div>

        <button
          onClick={fetchCredits}
          disabled={loading}
          className="p-2 hover:bg-gray-100 rounded-full transition-colors disabled:opacity-50"
          title="Refresh Credits"
        >
          <RefreshCw className={`w-5 h-5 text-gray-600 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>
    </header>
  );
};

export default Header;
