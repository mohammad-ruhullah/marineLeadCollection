import React, { useState, useEffect, useRef } from 'react';
import { apolloApi } from '../services/api';
import { ChevronDown, X, Filter } from 'lucide-react';

interface FilterSidebarProps {
  onFilterChange: (filters: any) => void;
}

interface Settings {
  countries: string[];
  titles: string[];
  excludeTitles: string[];
  excludeKeywords: string[];
  keywords: string[];
}


const MultiSelect = ({ 
  label, 
  options = [], 
  selected, 
  setSelected,
  variant = 'default'
}: { 
  label: string, 
  options?: string[], 
  selected: string[], 
  setSelected: (val: string[]) => void,
  variant?: 'default' | 'danger'
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const safeOptions = options || [];

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      setSelected(selected.filter(item => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const toggleAll = () => {
    if (selected.length === safeOptions.length) {
      setSelected([]);
    } else {
      setSelected([...safeOptions]);
    }
  };

  const colorClasses = variant === 'danger' 
    ? { 
        border: 'hover:border-red-400', 
        tag: 'bg-red-100 text-red-700', 
        tagHover: 'hover:text-red-900',
        optionHover: 'hover:bg-red-50',
        optionSelected: 'bg-red-50 text-red-700',
        dot: 'bg-red-600'
      }
    : { 
        border: 'hover:border-blue-400', 
        tag: 'bg-blue-100 text-blue-700', 
        tagHover: 'hover:text-blue-900',
        optionHover: 'hover:bg-blue-50',
        optionSelected: 'bg-blue-50 text-blue-700',
        dot: 'bg-blue-600'
      };

  return (
    <div className="mb-6 relative" ref={containerRef}>
      <label className="block text-sm font-semibold text-gray-700 mb-2">{label}</label>
      <div 
        onClick={() => setIsOpen(!isOpen)}
        className={`min-h-[42px] w-full border border-gray-300 rounded-md bg-white px-3 py-2 flex flex-wrap gap-2 cursor-pointer ${colorClasses.border} transition-colors`}
      >
        {selected.length === 0 && <span className="text-gray-400 text-sm">Select options...</span>}
        {selected.map(item => (
          <span key={item} className={`${colorClasses.tag} text-xs font-medium px-2 py-1 rounded-md flex items-center`}>
            {item}
            <button 
              onClick={(e) => { e.stopPropagation(); toggleOption(item); }}
              className={`ml-1 ${colorClasses.tagHover}`}
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
            className={`px-4 py-2 text-sm cursor-pointer border-b border-gray-100 hover:bg-gray-50 flex items-center justify-between font-bold ${selected.length === safeOptions.length && safeOptions.length > 0 ? (variant === 'danger' ? 'text-red-700' : 'text-blue-700') : 'text-gray-700'}`}
          >
            Select All
            <div className={`w-4 h-4 border rounded flex items-center justify-center ${selected.length === safeOptions.length && safeOptions.length > 0 ? (variant === 'danger' ? 'bg-red-600 border-red-600' : 'bg-blue-600 border-blue-600') : 'border-gray-300'}`}>
              {selected.length === safeOptions.length && safeOptions.length > 0 && <div className="w-1.5 h-1.5 bg-white rounded-full"></div>}
              {selected.length > 0 && selected.length < safeOptions.length && <div className="w-2 h-0.5 bg-gray-400 rounded-full"></div>}
            </div>
          </div>
          {safeOptions.length > 0 ? (
            safeOptions.map(option => (
              <div 
                key={option}
                onClick={() => toggleOption(option)}
                className={`px-4 py-2 text-sm cursor-pointer ${colorClasses.optionHover} flex items-center justify-between ${selected.includes(option) ? `${colorClasses.optionSelected} font-medium` : 'text-gray-700'}`}
              >
                {option}
                {selected.includes(option) && <div className={`w-2 h-2 ${colorClasses.dot} rounded-full`}></div>}
              </div>
            ))
          ) : (
            <div className="px-4 py-3 text-sm text-gray-400 italic">No options available</div>
          )}
        </div>
      )}
    </div>
  );
};

const FilterSidebar: React.FC<FilterSidebarProps> = ({ onFilterChange }) => {
  const [settings, setSettings] = useState<Settings>({ countries: [], titles: [], excludeTitles: [], excludeKeywords: [], keywords: [] });
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedTitles, setSelectedTitles] = useState<string[]>([]);
  const [selectedExcludeTitles, setSelectedExcludeTitles] = useState<string[]>([]);
  const [selectedExcludeKeywords, setSelectedExcludeKeywords] = useState<string[]>([]);
  const [selectedKeywords, setSelectedKeywords] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        console.log('FilterSidebar: Fetching settings...');
        const data = await apolloApi.getSettings();
        console.log('FilterSidebar: Received settings:', data);
        
        // Ensure all properties exist to avoid undefined errors
        const safeData = {
          countries: data.countries || [],
          titles: data.titles || [],
          excludeTitles: data.excludeTitles || [],
          excludeKeywords: data.excludeKeywords || [],
          keywords: data.keywords || []
        };
        
        setSettings(safeData);
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
    if (selectedExcludeTitles.length > 0) filters.person_not_titles = selectedExcludeTitles;
    if (selectedExcludeKeywords.length > 0) filters.exclude_org_keywords = selectedExcludeKeywords;
    if (selectedKeywords.length > 0) filters.organization_keyword_tags = selectedKeywords;
    
    console.log('Filters updated and synced to App:', filters);
    onFilterChange(filters);
  }, [selectedCountries, selectedTitles, selectedExcludeTitles, selectedExcludeKeywords, selectedKeywords]);

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
          label="Exclude Job Titles" 
          options={settings.excludeTitles} 
          selected={selectedExcludeTitles} 
          setSelected={setSelectedExcludeTitles}
          variant="danger"
        />
        <MultiSelect 
          label="Exclude Company Keywords" 
          options={settings.excludeKeywords} 
          selected={selectedExcludeKeywords} 
          setSelected={setSelectedExcludeKeywords}
          variant="danger"
        />
        <MultiSelect 
          label="Keywords" 
          options={settings.keywords} 
          selected={selectedKeywords} 
          setSelected={setSelectedKeywords} 
        />
      </div>
    </aside>
  );
};


export default FilterSidebar;
