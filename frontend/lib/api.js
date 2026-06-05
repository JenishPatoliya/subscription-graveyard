// frontend/lib/api.js

import axios from 'axios'

// Base URL from environment variable
const BASE_URL = process.env.NEXT_PUBLIC_API_URL

// Create axios instance with defaults
const api = axios.create({
  baseURL: BASE_URL,
  withCredentials: true, // Always send cookies
  headers: {
    'Content-Type': 'application/json'
  }
})

// ─── AUTH API CALLS ──────────────────────────────────

export const authAPI = {

  signup: async (name, email, password) => {
    const response = await api.post('/api/auth/signup', {
      name,
      email,
      password
    })
    return response.data
  },

  login: async (email, password) => {
    const response = await api.post('/api/auth/login', {
      email,
      password
    })
    return response.data
  },

  getMe: async () => {
    const response = await api.get('/api/auth/me')
    return response.data
  },

  logout: async () => {
    const response = await api.post('/api/auth/logout')
    return response.data
  }
}

// ─── GMAIL API CALLS ─────────────────────────────────

export const gmailAPI = {

  getAuthUrl: async () => {
    const response = await api.get('/api/gmail/auth-url')
    return response.data
  },

  getScanStatus: async () => {
    const response = await api.get('/api/gmail/scan-status')
    return response.data
  },

  rescan: async () => {
    const response = await api.post('/api/gmail/rescan')
    return response.data
  },

  disconnect: async (gmailAddress) => {
    const response = await api.delete(
      `/api/gmail/disconnect/${gmailAddress}`
    )
    return response.data
  }
}

// ─── SUBSCRIPTIONS API CALLS ─────────────────────────

export const subscriptionsAPI = {

  getAll: async () => {
    const response = await api.get('/api/subscriptions')
    return response.data
  },

  getOne: async (id) => {
    const response = await api.get(`/api/subscriptions/${id}`)
    return response.data
  },

  addManual: async (data) => {
    const response = await api.post('/api/subscriptions/manual', data)
    return response.data
  },

  updateStatus: async (id, userMarked) => {
    const response = await api.patch(`/api/subscriptions/${id}`, {
      userMarked
    })
    return response.data
  },

  delete: async (id) => {
    const response = await api.delete(`/api/subscriptions/${id}`)
    return response.data
  }
}

// ─── ALERTS API CALLS ────────────────────────────────

export const alertsAPI = {

  getAll: async () => {
    const response = await api.get('/api/alerts')
    return response.data
  }
}

// ─── REPORT API CALLS ────────────────────────────────

export const reportAPI = {

  get: async () => {
    const response = await api.get('/api/report')
    return response.data
  }
}

// ─── SETTINGS API CALLS ──────────────────────────────

export const settingsAPI = {

  get: async () => {
    const response = await api.get('/api/settings')
    return response.data
  },

  updatePreferences: async (data) => {
    const response = await api.patch('/api/settings/preferences', data)
    return response.data
  },

  deleteAllData: async () => {
    const response = await api.delete('/api/settings/data')
    return response.data
  }
}

export default api