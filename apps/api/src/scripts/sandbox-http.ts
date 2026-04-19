import axios, { AxiosRequestConfig, Method } from 'axios';
import { assertUrlAllowed } from '../lib/url-allowlist';

export function createSandboxHttp(allowlist: Set<string> | null) {
  const request = async (
    method: Method,
    url: string,
    config: AxiosRequestConfig = {},
  ) => {
    assertUrlAllowed(url, allowlist);
    return axios.request({
      ...config,
      method,
      url,
      validateStatus: () => true,
    });
  };

  return {
    get: (url: string, config?: AxiosRequestConfig) =>
      request('GET', url, config),
    post: (url: string, body?: unknown, config?: AxiosRequestConfig) =>
      request('POST', url, { ...config, data: body }),
    put: (url: string, body?: unknown, config?: AxiosRequestConfig) =>
      request('PUT', url, { ...config, data: body }),
    delete: (url: string, config?: AxiosRequestConfig) =>
      request('DELETE', url, config),
  };
}
