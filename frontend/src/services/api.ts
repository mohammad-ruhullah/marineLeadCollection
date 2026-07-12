import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || '/api';

export const apolloApi = {
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
