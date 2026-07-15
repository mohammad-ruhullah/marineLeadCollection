import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import FilterSidebar from './components/FilterSidebar';
import SearchModal from './components/SearchModal';
import LeadsTable from './components/LeadsTable';
import AdminSettings from './components/AdminSettings';
import { apolloApi } from './services/api';
import { Search, Database, LayoutGrid, List, Settings } from 'lucide-react';

function App() {
  const [filters, setFilters] = useState<any>({});
  console.log('App rendering, filters:', filters);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isCalculating, setIsCalculating] = useState(false);
  const [previewData, setPreviewData] = useState<any>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [saveResult, setSaveResult] = useState<{ success: boolean; total_saved: number } | null>(null);
  const [targetLeads, setTargetLeads] = useState(500);
  
  const [leads, setLeads] = useState<any[]>([]);
  const [leadsLoading, setLeadsLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'search' | 'leads' | 'admin'>('search');
  console.log('App rendering, activeTab:', activeTab);
  const [settingsKey, setSettingsKey] = useState(0); // Used to force refresh FilterSidebar

  const fetchLeads = async () => {
    setLeadsLoading(true);
    try {
      const data = await apolloApi.getLeads();
      console.log('Leads fetched from backend:', data);
      setLeads(data);
    } catch (error) {
      console.error('Error fetching leads:', error);
    } finally {
      setLeadsLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads();
  }, []);

  const handleCalculate = useCallback(async () => {
    console.log('handleCalculate triggered with filters:', filters);
    
    if (!filters || Object.keys(filters).length === 0) {
      alert('Please select at least one filter category before calculating leads.');
      return;
    }

    setIsCalculating(true);
    setPreviewData(null);
    setSaveResult(null);
    try {
      const data = await apolloApi.previewLeads(filters, targetLeads);
      console.log('Preview response:', data);
      setPreviewData(data);
      setIsModalOpen(true);
    } catch (error: any) {
      console.error('Error in preview:', error);
      const errorMsg = error.response?.data?.error || error.message;
      alert(`Failed to preview leads: ${errorMsg}`);
    } finally {
      setIsCalculating(false);
    }
  }, [filters, targetLeads]);

  const handleSaveLeads = async (selectedLeads: any[], category: string) => {
    setIsSaving(true);
    try {
      const result = await apolloApi.saveLeads(selectedLeads, category);
      setSaveResult(result);
      fetchLeads();
    } catch (error: any) {
      console.error('Error saving leads:', error);
      alert('Failed to save leads. Please check console.');
    } finally {
      setIsSaving(false);
    }
  };

  // When admin tab is closed, refresh settings for the sidebar
  useEffect(() => {
    if (activeTab !== 'admin') {
      setSettingsKey(prev => prev + 1);
    }
  }, [activeTab]);

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden font-sans">
      <Header />
      <div className="flex flex-1 overflow-hidden">
        {activeTab === 'search' && (
          <FilterSidebar 
            key={settingsKey}
            onFilterChange={setFilters} 
          />
        )}
        
        <main className={`flex-grow overflow-y-auto p-8 lg:p-12 ${activeTab !== 'search' ? 'w-full' : ''}`}>
          <div className="max-w-6xl mx-auto">
            {/* Navigation Tabs */}
            <div className="flex items-center space-x-1 mb-10 bg-gray-200/50 p-1 rounded-xl w-fit">
              <button
                onClick={() => setActiveTab('search')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'search' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid className="w-4 h-4" />
                <span>Search Hub</span>
              </button>
              <button
                onClick={() => setActiveTab('leads')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'leads' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <List className="w-4 h-4" />
                <span>Saved Leads</span>
                {leads.length > 0 && (
                  <span className="ml-1 bg-blue-100 text-blue-600 px-1.5 py-0.5 rounded text-[10px]">
                    {leads.length}
                  </span>
                )}
              </button>
              <button
                onClick={() => setActiveTab('admin')}
                className={`flex items-center space-x-2 px-6 py-2.5 rounded-lg text-sm font-bold transition-all ${
                  activeTab === 'admin' 
                  ? 'bg-white text-blue-600 shadow-sm' 
                  : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Settings className="w-4 h-4" />
                <span>Admin</span>
              </button>
            </div>

            {activeTab === 'search' && (
              <>
                <div className="mb-12">
                  <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Lead Generation Command Center</h2>
                  <p className="text-lg text-gray-600">
                    Precision-target your prospects using Apollo.io data directly from this dashboard.
                  </p>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
                    <div className="p-3 bg-blue-50 rounded-xl">
                      <Search className="w-6 h-6 text-blue-600" />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-500 uppercase tracking-wider">Active Filters</span>
                      <span className="text-2xl font-bold text-gray-900">{Object.keys(filters).length}</span>
                    </div>
                  </div>
                  
                  <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 flex items-start space-x-4">
                    <div className="p-3 bg-green-50 rounded-xl">
                      <Database className="w-6 h-6 text-green-600" />
                    </div>
                    <div>
                      <span className="block text-sm font-medium text-gray-500 uppercase tracking-wider">DB Leads</span>
                      <span className="text-2xl font-bold text-gray-900">{leads.length}</span>
                    </div>
                  </div>
                </div>

                <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
                  <div className="p-10 text-center">
                    <div className="w-20 h-20 bg-blue-50 text-blue-600 rounded-full flex items-center justify-center mx-auto mb-6">
                      {isCalculating ? (
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600"></div>
                      ) : (
                        <Search className="w-10 h-10" />
                      )}
                    </div>
                    <h3 className="text-2xl font-bold text-gray-900 mb-4">
                      {isCalculating ? 'Scanning Apollo Database...' : 'Ready to find new leads?'}
                    </h3>
                    <p className="text-gray-600 max-w-lg mx-auto mb-6">
                      Configure your target audience in the sidebar. We'll preview leads before using any credits.
                    </p>
                    <div className="flex items-center justify-center space-x-4 mb-6">
                      <label className="text-sm font-semibold text-gray-700">Target Leads:</label>
                      <input
                        type="number"
                        value={targetLeads}
                        onChange={e => setTargetLeads(Math.max(1, parseInt(e.target.value) || 0))}
                        className="w-24 px-3 py-2 border border-gray-300 rounded-lg text-center text-lg font-bold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                        min="1"
                        max="5000"
                      />
                    </div>
                    <button
                      onClick={handleCalculate}
                      disabled={isCalculating}
                      className="inline-flex items-center px-8 py-4 bg-blue-600 text-white font-bold rounded-2xl hover:bg-blue-700 transition-all shadow-xl hover:shadow-2xl active:transform active:scale-95 disabled:opacity-50"
                    >
                      {isCalculating ? 'Previewing...' : 'Preview Leads'}
                    </button>
                  </div>
                </div>
              </>
            )}

            {activeTab === 'leads' && (
              <div>
                <div className="mb-8 flex justify-between items-end">
                  <div>
                    <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Saved Leads Database</h2>
                    <p className="text-lg text-gray-600">
                      Manage and export your verified leads.
                    </p>
                  </div>
                  <button 
                    onClick={fetchLeads}
                    className="px-4 py-2 bg-white border border-gray-200 rounded-lg text-sm font-bold text-gray-700 hover:bg-gray-50 transition-colors shadow-sm"
                  >
                    Refresh List
                  </button>
                </div>
                <LeadsTable 
                  leads={leads} 
                  loading={leadsLoading} 
                  onRefresh={fetchLeads}
                />
              </div>
            )}

            {activeTab === 'admin' && (
              <AdminSettings />
            )}
          </div>
        </main>
      </div>

      <SearchModal 
        isOpen={isModalOpen}
        onClose={() => { setIsModalOpen(false); setPreviewData(null); setSaveResult(null); }}
        previewData={previewData}
        onSave={handleSaveLeads}
        isSaving={isSaving}
        saveResult={saveResult}
      />
    </div>
  );
}

export default App;
