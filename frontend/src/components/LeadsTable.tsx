import React, { useState, useMemo, useRef, useEffect } from 'react';
import { ExternalLink, Linkedin, Globe, Mail, Search as SearchIcon, Download, Shield, ShieldAlert, ShieldCheck, ChevronDown } from 'lucide-react';
import SelectionModal from './SelectionModal';
import { apolloApi } from '../services/api';

interface Lead {
  id: string;
  company: string;
  contact_name: string;
  title: string;
  email: string;
  status: string;
  country: string;
  website: string;
  linkedin: string;
  date_added: string;
  category?: string;
}

interface LeadsTableProps {
  leads: Lead[];
  loading: boolean;
  onRefresh: () => void;
  filters?: any;
}

const MultiSelectDropdown = ({ 
  label, 
  options, 
  selected, 
  setSelected, 
  placeholder 
}: { 
  label: string, 
  options: string[], 
  selected: string[], 
  setSelected: (val: string[]) => void,
  placeholder: string
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    if (isOpen) document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [isOpen]);

  const toggleOption = (option: string) => {
    if (selected.includes(option)) {
      setSelected(selected.filter(item => item !== option));
    } else {
      setSelected([...selected, option]);
    }
  };

  const getDisplayText = () => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) return selected[0];
    return `${selected.length} ${label}s`;
  };

  return (
    <div className="relative w-full md:w-56" ref={containerRef}>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className={`w-full flex items-center justify-between px-3 py-2.5 bg-white border ${selected.length > 0 ? 'border-blue-500 ring-1 ring-blue-500' : 'border-gray-200'} rounded-xl shadow-sm text-xs font-bold text-gray-700 hover:border-blue-400 transition-all`}
      >
        <span className="truncate">{getDisplayText()}</span>
        <ChevronDown className={`w-3.5 h-3.5 text-gray-400 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute z-50 w-full mt-2 bg-white border border-gray-100 rounded-xl shadow-xl max-h-64 overflow-y-auto">
          <div className="p-2 space-y-1">
            <div className="flex items-center justify-between px-3 py-2 border-b border-gray-50 mb-1">
              <button
                onClick={() => setSelected(options)}
                className="text-xs font-bold text-blue-600 hover:text-blue-700 transition-colors"
              >
                Select All
              </button>
              <button
                onClick={() => setSelected([])}
                className="text-xs font-bold text-gray-400 hover:text-red-600 transition-colors"
              >
                Clear
              </button>
            </div>
            {options.map(option => (
              <label 
                key={option} 
                className={`flex items-center px-3 py-2 rounded-lg cursor-pointer transition-colors ${selected.includes(option) ? 'bg-blue-50 text-blue-700' : 'hover:bg-gray-50 text-gray-600'}`}
              >
                <input
                  type="checkbox"
                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 mr-3"
                  checked={selected.includes(option)}
                  onChange={() => toggleOption(option)}
                />
                <span className="text-sm font-medium">{option}</span>
              </label>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

const ITEMS_PER_PAGE = 50;

const LeadsTable: React.FC<LeadsTableProps> = ({ leads, loading, onRefresh, filters = {} }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCountries, setSelectedCountries] = useState<string[]>([]);
  const [selectedRoles, setSelectedRoles] = useState<string[]>([]);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isVerificationModalOpen, setIsVerificationModalOpen] = useState(false);
  const [isSelectionModalOpen, setIsSelectionModalOpen] = useState(false);
  const [selectionModalMode, setSelectionModalMode] = useState<'enrich' | 'verify'>('enrich');

  // Extract unique values from the data
  const availableCountries = useMemo(() => {
    const countries = leads.map(l => l.country).filter(Boolean);
    return Array.from(new Set(countries)).sort();
  }, [leads]);

  const availableRoles = useMemo(() => {
    const roles = leads.map(l => l.title).filter(Boolean);
    return Array.from(new Set(roles)).sort();
  }, [leads]);

  const availableStatuses = useMemo(() => {
    const statuses = leads.map(l => l.status).filter(Boolean);
    return Array.from(new Set(statuses)).sort();
  }, [leads]);

  const availableCategories = useMemo(() => {
    const cats = leads.map(l => l.category).filter(Boolean) as string[];
    return Array.from(new Set(cats)).sort();
  }, [leads]);

  // Stats calculation
  const stats = useMemo(() => {
    const hasEmail = leads.filter(l => l.status !== 'Not Enriched').length;
    const pendingEmail = leads.filter(l => l.status === 'Not Enriched').length;
    return {
      total: leads.length,
      haveEmail: hasEmail,
      pendingEmail: pendingEmail,
      invalid: leads.filter(l => l.status === 'Invalid' || l.status === 'No Result Found').length,
      pendingVerification: leads.filter(l => l.status === 'Not Verified').length,
      verified: leads.filter(l => l.status === 'Verified').length
    };
  }, [leads]);

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      // 1. Sidebar Filters (Legacy support if still used)
      if (filters.person_locations && filters.person_locations.length > 0) {
        if (!filters.person_locations.includes(lead.country)) return false;
      }
      
      if (filters.person_titles && filters.person_titles.length > 0) {
        if (!filters.person_titles.includes(lead.title)) return false;
      }

      // 2. New Multi-Select Dropdown Filters
      if (selectedCountries.length > 0 && !selectedCountries.includes(lead.country)) return false;
      if (selectedRoles.length > 0 && !selectedRoles.includes(lead.title)) return false;
      if (selectedStatuses.length > 0 && !selectedStatuses.includes(lead.status)) return false;
      if (selectedCategories.length > 0 && !selectedCategories.includes(lead.category || '')) return false;

      // 3. Search Term Filter
      const search = searchTerm.toLowerCase();
      const company = (lead.company || '').toLowerCase();
      const country = (lead.country || '').toLowerCase();
      const name = (lead.contact_name || '').toLowerCase();
      const title = (lead.title || '').toLowerCase();
      const categoryText = (lead.category || '').toLowerCase();
      
      return company.includes(search) || 
             country.includes(search) || 
             name.includes(search) || 
             title.includes(search) ||
             categoryText.includes(search);
    });
  }, [leads, searchTerm, selectedCountries, selectedRoles, selectedStatuses, selectedCategories, filters]);

  const totalPages = useMemo(() => Math.max(1, Math.ceil(filteredLeads.length / ITEMS_PER_PAGE)), [filteredLeads]);

  const paginatedLeads = useMemo(() => {
    const start = (currentPage - 1) * ITEMS_PER_PAGE;
    return filteredLeads.slice(start, start + ITEMS_PER_PAGE);
  }, [filteredLeads, currentPage]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, selectedCountries, selectedRoles, selectedStatuses, selectedCategories]);

  const handleVerify = () => {
    if (stats.pendingVerification === 0) {
      alert('No leads pending verification.');
      return;
    }
    setSelectionModalMode('verify');
    setIsSelectionModalOpen(true);
  };

  const handleEnrich = () => {
    if (stats.pendingEmail === 0) {
      alert('No leads pending email enrichment.');
      return;
    }
    setSelectionModalMode('enrich');
    setIsSelectionModalOpen(true);
  };

  const handleSelectionAction = async (ids: string[]) => {
    if (selectionModalMode === 'enrich') {
      await apolloApi.enrichEmails(ids);
    } else {
      await apolloApi.verifyLeads(ids);
    }
    onRefresh();
  };

  const csvEscape = (value: any) => {
    const str = String(value ?? '');
    return `"${str.replace(/"/g, '""')}"`;
  };

  const downloadCSV = () => {
    const headers = ['Company', 'Contact Name', 'Title', 'Email', 'Status', 'Country', 'Website', 'LinkedIn', 'Date Added', 'Category'];
    const BOM = '\uFEFF';
    const csvContent = [
      headers.join(','),
      ...filteredLeads.map(lead => [
        csvEscape(lead.company),
        csvEscape(lead.contact_name),
        csvEscape(lead.title),
        csvEscape(lead.email),
        csvEscape(lead.status),
        csvEscape(lead.country),
        csvEscape(lead.website),
        csvEscape(lead.linkedin),
        csvEscape((lead as any).created_at || lead.date_added ? new Date((lead as any).created_at || lead.date_added).toLocaleDateString() : 'N/A'),
        csvEscape(lead.category || '')
      ].join(','))
    ].join('\n');

    const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `leads_export_${new Date().toISOString().split('T')[0]}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'Verified':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-green-100 text-green-700 uppercase tracking-wide">Verified</span>;
      case 'Not Verified':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-yellow-100 text-yellow-700 uppercase tracking-wide">Not Verified</span>;
      case 'Invalid':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-red-100 text-red-700 uppercase tracking-wide">Invalid</span>;
      case 'Risky':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">Risky</span>;
      case 'No Result Found':
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase tracking-wide">No Result Found</span>;
      default:
        return <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-gray-100 text-gray-700 uppercase tracking-wide">{status}</span>;
    }
  };

  if (loading) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
        <p className="text-gray-500 font-medium">Loading saved leads...</p>
      </div>
    );
  }

  if (leads.length === 0) {
    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-12 text-center">
        <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4 text-gray-400">
          <Mail className="w-8 h-8" />
        </div>
        <h3 className="text-lg font-bold text-gray-800 mb-1">No leads saved yet</h3>
        <p className="text-gray-500">Run a search and import leads to see them here.</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Stats Dashboard */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-blue-50 rounded-xl">
            <Mail className="w-5 h-5 text-blue-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Total Leads</p>
            <p className="text-xl font-black text-gray-900">{stats.total}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-green-50 rounded-xl">
            <ShieldCheck className="w-5 h-5 text-green-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Have Email</p>
            <p className="text-xl font-black text-gray-900">{stats.haveEmail}</p>
          </div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-red-50 rounded-xl">
            <ShieldAlert className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Invalid</p>
            <p className="text-xl font-black text-gray-900">{stats.invalid}</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-amber-50 rounded-xl">
            <Mail className="w-5 h-5 text-amber-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Email</p>
            <p className="text-xl font-black text-gray-900">{stats.pendingEmail}</p>
          </div>
          <button
            onClick={handleEnrich}
            disabled={stats.pendingEmail === 0}
            className="px-3 py-1.5 bg-amber-600 text-white text-xs font-bold rounded-lg hover:bg-amber-700 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            Get Emails
          </button>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-gray-100 shadow-sm flex items-center space-x-4">
          <div className="p-3 bg-yellow-50 rounded-xl">
            <Shield className="w-5 h-5 text-yellow-600" />
          </div>
          <div className="flex-1">
            <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Pending Verification</p>
            <p className="text-xl font-black text-gray-900">{stats.pendingVerification}</p>
          </div>
          <button
            onClick={handleVerify}
            disabled={stats.pendingVerification === 0}
            className="px-3 py-1.5 bg-yellow-600 text-white text-xs font-bold rounded-lg hover:bg-yellow-700 transition-colors disabled:opacity-40 whitespace-nowrap"
          >
            Verify
          </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex flex-col gap-6">
        {/* Row 1: Hero Search Bar */}
        <div className="relative w-full">
          <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
            <SearchIcon className="h-6 w-6 text-gray-400" />
          </div>
          <input
            type="text"
            placeholder="Search leads by name, company, title, or country..."
            className="block w-full pl-14 pr-4 py-4 border border-gray-200 rounded-2xl leading-5 bg-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-lg transition-all shadow-sm font-medium"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>

        {/* Row 2: Filters & Actions */}
        <div className="flex flex-col lg:flex-row gap-4 items-start lg:items-end justify-between">
          <div className="flex flex-wrap items-end gap-3 w-full lg:w-auto">
            <MultiSelectDropdown 
              label="Country"
              options={availableCountries}
              selected={selectedCountries}
              setSelected={setSelectedCountries}
              placeholder="All Countries"
            />

            <MultiSelectDropdown 
              label="Role"
              options={availableRoles}
              selected={selectedRoles}
              setSelected={setSelectedRoles}
              placeholder="All Roles"
            />

            <MultiSelectDropdown 
              label="Status"
              options={availableStatuses}
              selected={selectedStatuses}
              setSelected={setSelectedStatuses}
              placeholder="All Statuses"
            />

            {availableCategories.length > 0 && (
              <MultiSelectDropdown 
                label="Category"
                options={availableCategories}
                selected={selectedCategories}
                setSelected={setSelectedCategories}
                placeholder="All Categories"
              />
            )}

            {(searchTerm || selectedCountries.length > 0 || selectedRoles.length > 0 || selectedStatuses.length > 0 || selectedCategories.length > 0) && (
              <button
                onClick={() => {
                  setSearchTerm('');
                  setSelectedCountries([]);
                  setSelectedRoles([]);
                  setSelectedStatuses([]);
                  setSelectedCategories([]);
                }}
                className="px-4 py-3 text-sm font-bold text-red-600 hover:text-red-700 hover:bg-red-50 rounded-xl transition-colors whitespace-nowrap"
              >
                Clear All
              </button>
            )}
          </div>
          
          <div className="flex items-center space-x-3 w-full lg:w-auto">
            <button
              onClick={downloadCSV}
              disabled={filteredLeads.length === 0}
              className="flex-1 lg:flex-none flex items-center justify-center space-x-2 px-6 py-3 bg-green-600 text-white font-bold rounded-xl hover:bg-green-700 transition-all shadow-md active:transform active:scale-95 disabled:opacity-50"
            >
              <Download className="w-4 h-4" />
              <span className="whitespace-nowrap">Export CSV ({filteredLeads.length})</span>
            </button>
          </div>
        </div>
      </div>

      {/* Selection Modal */}
      <SelectionModal
        isOpen={isSelectionModalOpen}
        onClose={() => { setIsSelectionModalOpen(false); onRefresh(); }}
        title={selectionModalMode === 'enrich' ? 'Email Enrichment' : 'Email Verification'}
        leads={selectionModalMode === 'enrich'
          ? leads.filter(l => l.status === 'Not Enriched').map(l => ({ ...l, contact_name: l.contact_name }))
          : leads.filter(l => l.status === 'Not Verified').map(l => ({ ...l, contact_name: l.contact_name }))
        }
        actionLabel={selectionModalMode === 'enrich' ? 'Enrich Selected' : 'Verify Selected'}
        onAction={handleSelectionAction}
      />

      {/* Pagination Info */}
      {filteredLeads.length > 0 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-gray-500 font-medium">
            Showing <span className="font-bold text-gray-700">{(currentPage - 1) * ITEMS_PER_PAGE + 1}</span> 
            {' '}-{' '}
            <span className="font-bold text-gray-700">{Math.min(currentPage * ITEMS_PER_PAGE, filteredLeads.length)}</span>
            {' '}of{' '}
            <span className="font-bold text-gray-700">{filteredLeads.length}</span> leads
          </p>
          
          <div className="flex items-center space-x-2">
            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage <= 1}
              className="px-3 py-1.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Previous
            </button>
            
            {Array.from({ length: Math.min(totalPages, 7) }, (_, i) => {
              const startPage = Math.max(1, currentPage - 3);
              const page = startPage + i;
              if (page > totalPages) return null;
              return (
                <button
                  key={page}
                  onClick={() => setCurrentPage(page)}
                  className={`w-9 h-9 text-sm font-bold rounded-lg transition-colors ${
                    page === currentPage
                      ? 'bg-blue-600 text-white'
                      : 'text-gray-600 bg-white border border-gray-200 hover:bg-gray-50'
                  }`}
                >
                  {page}
                </button>
              );
            })}
            
            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages}
              className="px-3 py-1.5 text-sm font-bold text-gray-600 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              Next
            </button>
          </div>
        </div>
      )}

      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-100">
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Company</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Contact</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Email / Status</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Location</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Category</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest">Links</th>
                <th className="px-6 py-5 text-xs font-black text-gray-400 uppercase tracking-widest text-right">Added</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {paginatedLeads.map((lead) => (
                <tr key={lead.id} className="hover:bg-blue-50/30 transition-colors group">
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="font-bold text-gray-900 group-hover:text-blue-700 transition-colors">
                      {lead.company}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm font-bold text-gray-800">{lead.contact_name}</div>
                    <div className="text-xs text-gray-400 truncate max-w-[180px] font-medium">{lead.title}</div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center space-x-3">
                      <span className="text-sm text-gray-700 font-bold">{lead.email}</span>
                      {getStatusBadge(lead.status)}
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="text-sm text-gray-600 font-bold">{lead.country}</div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    {lead.category ? (
                      <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700 uppercase tracking-wide">{lead.category}</span>
                    ) : (
                      <span className="text-xs text-gray-300 italic">—</span>
                    )}
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap">
                    <div className="flex items-center space-x-3 text-gray-300">
                      {lead.website && lead.website !== 'N/A' && (
                        <a href={lead.website} target="_blank" rel="noopener noreferrer" className="hover:text-blue-600 transition-colors">
                          <Globe className="w-4 h-4" />
                        </a>
                      )}
                      {lead.linkedin && (
                        <a href={lead.linkedin} target="_blank" rel="noopener noreferrer" className="hover:text-blue-700 transition-colors">
                          <Linkedin className="w-4 h-4" />
                        </a>
                      )}
                      <button className="hover:text-blue-600 transition-colors">
                        <ExternalLink className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                  <td className="px-6 py-5 whitespace-nowrap text-right text-xs font-bold text-gray-400 uppercase">
                    {(lead as any).created_at || (lead as any).date_added ? 
                      new Date((lead as any).created_at || (lead as any).date_added).toLocaleDateString() : 
                      'N/A'}
                  </td>
                </tr>
              ))}
              {filteredLeads.length === 0 && leads.length > 0 && (
                <tr>
                  <td colSpan={7} className="px-6 py-16 text-center text-gray-400 italic font-medium">
                    No results found for "{searchTerm}"
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};

export default LeadsTable;
