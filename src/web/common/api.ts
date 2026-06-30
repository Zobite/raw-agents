/**
 * API utility functions for making HTTP requests
 */

const TOKEN_KEY = "raw_agents_auth_token";

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function setAuthToken(token: string): void {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY);
}

// Base API client
export class ApiClient {
  private baseURL: string;

  constructor(baseURL?: string) {
    this.baseURL = baseURL ?? (import.meta as any).env?.VITE_API_URL ?? "";
  }

  private getHeaders(isFormData = false): HeadersInit {
    const headers: HeadersInit = {};

    if (!isFormData) {
      headers["Content-Type"] = "application/json";
    }

    const token = getAuthToken();
    if (token) {
      headers.Authorization = `Bearer ${token}`;
    }

    return headers;
  }

  private async handleResponse<T>(response: Response): Promise<T> {
    if (!response.ok) {
      // Handle 401 — clear token and redirect to login
      if (response.status === 401) {
        clearAuthToken();
        if (window.location.pathname !== "/login") {
          window.location.href = "/login";
        }
      }

      const error = await response.json().catch(() => ({ message: "Request failed" }));
      throw new Error(error.message ?? `HTTP ${response.status}`);
    }

    return response.json();
  }

  async get<T>(endpoint: string, params?: Record<string, any>): Promise<T> {
    let url = `${this.baseURL}${endpoint}`;
    if (params && Object.keys(params).length > 0) {
      const queryString = new URLSearchParams(
        Object.entries(params)
          .filter(([_, value]) => value !== undefined && value !== null && value !== "")
          .map(([key, value]) => [key, String(value)]),
      ).toString();
      if (queryString) {
        url += `?${queryString}`;
      }
    }

    const response = await fetch(url, {
      method: "GET",
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async post<T = any>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async put<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "PUT",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async patch<T>(endpoint: string, data?: any): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "PATCH",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    return this.handleResponse<T>(response);
  }

  async delete<T>(endpoint: string): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "DELETE",
      headers: this.getHeaders(),
    });

    return this.handleResponse<T>(response);
  }

  async putFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "PUT",
      headers: this.getHeaders(true),
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async postFormData<T>(endpoint: string, formData: FormData): Promise<T> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(true),
      body: formData,
    });

    return this.handleResponse<T>(response);
  }

  async postFile(endpoint: string, data?: any): Promise<Response> {
    const response = await fetch(`${this.baseURL}${endpoint}`, {
      method: "POST",
      headers: this.getHeaders(),
      body: data ? JSON.stringify(data) : undefined,
    });

    if (!response.ok) {
      const contentType = response.headers.get("content-type");
      if (contentType?.includes("application/json")) {
        const error = await response.json().catch(() => ({ message: "Request failed" }));
        throw new Error(error.message ?? `HTTP ${response.status}`);
      }
      throw new Error(`HTTP ${response.status}: ${response.statusText}`);
    }

    return response;
  }
}

// Create a default API client instance
export const apiClient = new ApiClient();
