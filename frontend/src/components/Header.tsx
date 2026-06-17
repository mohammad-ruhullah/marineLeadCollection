import React from 'react';
import { Zap } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 py-4 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-2">
        <Zap className="text-blue-600 w-8 h-8" />
        <h1 className="text-xl font-bold text-gray-800 tracking-tight">
          ShipParts <span className="text-blue-600">LeadGen</span>
        </h1>
      </div>
    </header>
  );
};

export default Header;
