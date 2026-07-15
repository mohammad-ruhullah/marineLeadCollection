import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apolloApi = {
  previewLeads: async (filters: any, targetLeads: number) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/preview`, { filters, targetLeads });
    return response.data;
  },
  saveLeads: async (leads: any[], category: string) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/save-leads`, { leads, category });
    return response.data;
  },
  enrichEmails: async (limit?: number) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/enrich-emails`, { limit });
    return response.data;
  },
  preFlight: async (filters: any) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/pre-flight`, filters);
    return response.data;
  },
  bulkFetch: async (filters: any, maxLeads: number, category?: string) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/bulk-fetch`, { filters, maxLeads, category });
    return response.data;
  },
  getSettings: async () => {
    const response = await axios.get(`${API_BASE_URL}/settings`);
    return response.data;
  },
  getLeads: async () => {
    const response = await axios.get(`${API_BASE_URL}/leads`);
    return response.data;
  },
  addSetting: async (type: string, value: string) => {
    const response = await axios.post(`${API_BASE_URL}/settings`, { type, value });
    return response.data;
  },
  deleteSetting: async (id: string | number) => {
    const response = await axios.delete(`${API_BASE_URL}/settings/${id}`);
    return response.data;
  },
  verifyLeads: async (limit?: number) => {
    const response = await axios.post(`${API_BASE_URL}/apollo/leads/verify`, { limit });
    return response.data;
  }
};
