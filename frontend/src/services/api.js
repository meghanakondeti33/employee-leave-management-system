const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000/api';

/**
 * Custom API Error Class
 */
export class ApiError extends Error {
  constructor(message, status, data = null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Reusable fetch wrapper for API communication
 */
const request = async (endpoint, options = {}) => {
  const token = localStorage.getItem('token');
  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response;
  try {
    response = await fetch(`${API_BASE_URL}${endpoint}`, config);
  } catch (err) {
    throw new ApiError('Unable to connect to the server. Please check your network connection.', 0);
  }

  let data = null;
  const contentType = response.headers.get('content-type');
  if (contentType && contentType.includes('application/json')) {
    try {
      data = await response.json();
    } catch (e) {
      data = null;
    }
  }

  if (!response.ok) {
    const errorMessage = (data && data.message) 
      ? data.message 
      : `HTTP Error ${response.status}: ${response.statusText}`;

    // Standardized 401 Unauthorized handling (token expired/invalid)
    if (response.status === 401 && token) {
      // Broadcast token invalidation event so AuthContext can handle logout
      window.dispatchEvent(new Event('auth:unauthorized'));
    }

    throw new ApiError(errorMessage, response.status, data);
  }

  return data;
};

export const api = {
  get: (endpoint) => request(endpoint, { method: 'GET' }),
  post: (endpoint, body) => request(endpoint, { method: 'POST', body: JSON.stringify(body) }),
  put: (endpoint, body) => request(endpoint, { method: 'PUT', body: JSON.stringify(body) }),
  delete: (endpoint) => request(endpoint, { method: 'DELETE' }),
};
