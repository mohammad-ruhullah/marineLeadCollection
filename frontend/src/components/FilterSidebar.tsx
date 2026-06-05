import React, { useState, useEffect } from 'react';
import { apolloApi } from '../services/api';
import { ChevronDown, X, Filter } from 'lucide-react';

interface FilterSidebarProps {
  onFilterChange: (filters: any) => void;
  onCalculate: () => void;
  isCalculating: boolean;
}

interface Settings {
  countries: string[];
  titles: string[];
  keywords: string[];
}


const MultiSelect = ({ 
  label, 
  options, 
  selected, 
  setSelected 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  setSelected: (val: string[]) => void 
}) => {
  const [isOpen, setIsOpen] = useState(false);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      setSelected(selected.filter(item => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const toggleAll = () => {
    if (selected.length === options.length) {
      setSelected([]);
    } else {
      setSelected([...options]);
    }
  };

  return (
    <div className="mb-6 relative">
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className="min-h-[42px] w-full border border-gray-300 rounded-md bg-white px-3 py-2 flex flex-wrap gap-2 cursor-pointer hover:border-blue-400 transition-colors"
      >
        {selected.length === 0 && <span className="text-gray-400 text-sm">Select options...</span>}
        {selected.map(item => (
          <span key={item} className="bg-blue-100 text-blue-700 text-xs font-medium px-2 py-1 rounded-md flex items-center">
            {item}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleOption(item); }}
              className="ml-1 hover:text-blue-900"
            >
              <X className="w-3 h-3" />
            </button>
          </span>
        ))}
        <ChevronDown className="ml-auto w-4 h-4 text-gray-500 self-center" />
      </div>
      
      {isOpen && (
        <div className="absolute z-10 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
          <div 
            onClick={(e) => { e.stopPropagation(); toggleAll(); }}
            className={`px-4 py-2 text-sm cursor-pointer border-b border-gray-100 hover:bg-gray-50 flex items-center justify-between font-bold ${selected.length === options.length ? 'text-blue-700' : 'text-gray-700'}`}
          >
            Select All
            <div className={`w-4 h-4 border rounded flex items-center justify-center ${selected.length === options.length ? 'bg-blue-600 border-blue-600' : 'border-gray-300'}`}>
              {selected.length === options.length && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              {selected.length > 0 && selected.length < options.length && <div className="w-2 h-0.5 bg-gray-400 rounded-full"></div>}
            </div>
          </div>
          {options.map(option => (
            <div 
              key={option}
              onClick={() => toggleOption(option)}
              className={`px-4 py-2 text-sm cursor-pointer hover:bg-blue-50 flex items-center justify-between ${selected.includes(option) ? 'bg-blue-50 text-blue-700 font-medium' : 'text-gray-700'}`}
            >
              {option}
              {selected.includes(option) && <div className="w-2 h-2 bg-blue-600 rounded-full"></div>}
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

const FilterSidebar: React.FC<FilterSidebarProps> = React.memo(({ onFilterChange, onCalculate, isCalculating }) => {
  const [settings, setSettings] = useState<Settings>({ countries: [], titles: [], keywords: [] });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const data = await apolloApi.getSettings();
        setSettings(data);
      } catch (error) {
        console.error('Error fetching settings:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchSettings();
  }, []);

  useEffect(() => {
    const filters: any = {};
    if (selectedCountries.length > 0) filters.person_locations = selectedCountries;
    if (selectedTitles.length > 0) filters.person_titles = selectedTitles;
    if (selectedKeywords.length > 0) filters.q_organization_keyword_tags = selectedKeywords;
    
    console.log('Filters updated:', filters);
    onFilterChange(filters);
  }, [selectedCountries, selectedTitles, selectedKeywords]);

  if (loading) return <div className="p-6 text-gray-500">Loading filters...</div>;

  return (
    <aside className="w-80 bg-white border-r border-gray-200 flex flex-col h-full overflow-y-auto p-6 shadow-sm">
      <div className="flex items-center space-x-2 mb-8">
        <Filter className="w-5 h-5 text-blue-600" />
        <h2 className="text-lg font-bold text-gray-800">Filter Leads</h2>
      </div>

      <div className="flex-grow">
        <MultiSelect 
          label="Country" 
          options={settings.countries} 
          selected={selectedCountries} 
          setSelected={setSelectedCountries} 
        />
        <MultiSelect 
          label="Job Title" 
          options={settings.titles} 
          selected={selectedTitles} 
          setSelected={setSelectedTitles} 
        />
        <MultiSelect 
          label="Keywords" 
          options={settings.keywords} 
          selected={selectedKeywords} 
          setSelected={setSelectedKeywords} 
        />
      </div>

      <button
        onClick={onCalculate}
        disabled={isCalculating}
        className="mt-6 w-full bg-blue-600 text-white font-bold py-3 px-4 rounded-lg hover:bg-blue-700 transition-colors shadow-md active:transform active:scale-95 disabled:opacity-50"
      >
        {isCalculating ? 'Calculating...' : 'Calculate Leads'}
      </button>
    </aside>
  );
});


export default FilterSidebar;
