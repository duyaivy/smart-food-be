// src/config/axiosClient.ts
import axios, { AxiosInstance, AxiosResponse, InternalAxiosRequestConfig } from 'axios';
import axiosRetry from 'axios-retry';

// Lấy base URL từ env
const BASE_URL = process.env.RECOMMENDATION_SYSTEM_URL || 'http://localhost:3000';
const TIMEOUT = Number(process.env.AXIOS_TIMEOUT_MS) || 60000; // 60s default

// Tạo instance axios
const apiClient: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: TIMEOUT,
  headers: {
    'Content-Type': 'application/json'
  }
});

// Cấu hình retry: 3 lần, retry khi network error hoặc 5xx response
axiosRetry(apiClient, {
  retries: 3,
  retryDelay: (retryCount) => {
    console.log(`Retrying request, attempt #${retryCount}`);
    return retryCount * 1000; // delay tăng dần
  },
  retryCondition: (error) => {
    // Retry khi network error hoặc 5xx response
    return axiosRetry.isNetworkError(error) || axiosRetry.isRetryableError(error);
  }
});

// Interceptor request: log thông tin request
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    console.log(`[Axios Request] ${config.method?.toUpperCase()} ${config.url}`);
    return config; // rất quan trọng, nếu thiếu sẽ fail request
  },
  (error) => {
    console.error('[Axios Request Error]', error);
    return Promise.reject(error);
  }
);

// Interceptor response: log response
apiClient.interceptors.response.use(
  (response: AxiosResponse) => {
    console.log(`[Axios Response] ${response.status} ${response.config.url}`);
    return response;
  },
  (error) => {
    console.error('[Axios Response Error]', error?.response?.status, error?.config?.url);
    return Promise.reject(error);
  }
);

// Helper function để set Bearer token
export const setAuthToken = (token: string) => {
  apiClient.defaults.headers.common['Authorization'] = `Bearer ${token}`;
};

export default apiClient;
