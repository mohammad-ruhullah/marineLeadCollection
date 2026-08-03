import React, { useState, useEffect } from 'react';
import { apolloApi } from '../services/api';
import { Plus, Trash2, Settings, Globe, Briefcase, Tag, AlertCircle, X, CheckCircle2 } from 'lucide-react';

interface Setting {
  id: number;
  type: 'country' | 'title' | 'keyword' | 'exclude_title' | 'exclude_keyword';
  value: string;
}

const AdminSettings: React.FC = () => {
  const [settings, setSettings] = useState<Setting[]>([]);
  const [loading, setLoading] = useState(true);
  const [newValue, setNewValue] = useState('');
  const [newType, setNewType] = useState<'country' | 'title' | 'keyword' | 'exclude_title' | 'exclude_keyword'>('country');
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchSettings = async () => {
    setLoading(true);
    try {
      const data = await apolloApi.getSettings();
      setSettings(data.raw);
    } catch (err) {
      console.error('Error fetching settings:', err);
      setError('Failed to load settings.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSettings();
  }, []);

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newValue.trim()) return;

    try {
      await apolloApi.addSetting(newType, newValue.trim());
      setNewValue('');
      setError(null);
      setSuccess(`"${newValue.trim()}" added successfully.`);
      fetchSettings();
    } catch (err: any) {
      console.error('Error adding setting:', err);
      setError(err.response?.data?.error || err.message || 'Failed to add setting.');
      setSuccess(null);
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm('Are you sure you want to delete this setting?')) return;
    try {
      await apolloApi.deleteSetting(id);
      fetchSettings();
    } catch (err) {
      console.error('Error deleting setting:', err);
      setError('Failed to delete setting.');
    }
  };

  const SettingGroup = ({ type, icon: Icon, title, colorClass }: { type: string, icon: any, title: string, colorClass: string }) => {
    const groupItems = settings.filter(s => s.type === type);

    return (
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className={`px-6 py-4 border-b border-gray-50 flex items-center space-x-2 ${colorClass}`}>
          <Icon className="w-5 h-5" />
          <h3 className="font-bold uppercase tracking-wider text-sm">{title}</h3>
          <span className="ml-auto bg-white/50 px-2 py-0.5 rounded text-xs font-black">{groupItems.length}</span>
        </div>
        <div className="p-4">
          <div className="flex flex-wrap gap-2">
            {groupItems.map(item => (
              <span key={item.id} className="inline-flex items-center bg-gray-50 border border-gray-200 px-3 py-1.5 rounded-lg text-sm font-medium text-gray-700 group">
                {item.value}
                <button 
                  onClick={() => handleDelete(item.id)}
                  className="ml-2 text-gray-400 hover:text-red-500 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </span>
            ))}
            {groupItems.length === 0 && (
              <p className="text-gray-400 text-sm italic py-2">No {title.toLowerCase()} added yet.</p>
            )}
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto pb-12">
      <div className="mb-10 flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-extrabold text-gray-900 mb-2">Admin Configuration</h2>
          <p className="text-lg text-gray-600">Manage the global filter options for the Lead Generator.</p>
        </div>
        <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
          <Settings className="w-8 h-8" />
        </div>
      </div>

      {error && (
        <div className="mb-8 p-4 bg-red-50 border border-red-100 rounded-xl flex items-center space-x-3 text-red-700">
          <AlertCircle className="w-5 h-5" />
          <span className="font-medium">{error}</span>
          <button onClick={() => setError(null)} className="ml-auto font-bold underline">Dismiss</button>
        </div>
      )}

      {success && (
        <div className="mb-8 p-4 bg-green-50 border border-green-100 rounded-xl flex items-center space-x-3 text-green-700">
          <CheckCircle2 className="w-5 h-5" />
          <span className="font-medium">{success}</span>
          <button onClick={() => setSuccess(null)} className="ml-auto font-bold underline">Dismiss</button>
        </div>
      )}

      {/* Add New Setting Form */}
      <div className="bg-white rounded-3xl shadow-sm border border-gray-100 p-8 mb-12">
        <h3 className="text-xl font-bold text-gray-800 mb-6 flex items-center space-x-2">
          <Plus className="w-5 h-5 text-blue-600" />
          <span>Add New Option</span>
        </h3>
        <form onSubmit={handleAdd} className="flex flex-col md:flex-row gap-4">
          <select
            value={newType}
            onChange={(e) => setNewType(e.target.value as any)}
            className="px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none font-bold text-gray-700 bg-gray-50"
          >
            <option value="country">Country</option>
            <option value="title">Job Title</option>
            <option value="exclude_title">Exclude Job Title</option>
            <option value="keyword">Keyword</option>
            <option value="exclude_keyword">Exclude Keyword</option>
          </select>
          <input
            type="text"
            value={newValue}
            onChange={(e) => setNewValue(e.target.value)}
            placeholder={`Enter new ${newType}...`}
            className="flex-grow px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 outline-none"
          />
          <button
            type="submit"
            disabled={!newValue.trim()}
            className="px-8 py-3 bg-blue-600 text-white font-bold rounded-xl hover:bg-blue-700 transition-all shadow-md active:transform active:scale-95 disabled:opacity-50"
          >
            Add Option
          </button>
        </form>
      </div>

      {loading ? (
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto"></div>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-8">
          <SettingGroup 
            type="country" 
            icon={Globe} 
            title="Countries" 
            colorClass="bg-blue-50 text-blue-700"
          />
          <SettingGroup 
            type="title" 
            icon={Briefcase} 
            title="Job Titles" 
            colorClass="bg-purple-50 text-purple-700"
          />
          <SettingGroup 
            type="exclude_title" 
            icon={X} 
            title="Exclude Job Titles" 
            colorClass="bg-red-50 text-red-700"
          />
          <SettingGroup 
            type="keyword" 
            icon={Tag} 
            title="Keywords" 
            colorClass="bg-green-50 text-green-700"
          />
          <SettingGroup 
            type="exclude_keyword" 
            icon={AlertCircle} 
            title="Exclude Keywords" 
            colorClass="bg-orange-50 text-orange-700"
          />
        </div>
      )}
    </div>
  );
};

export default AdminSettings;
