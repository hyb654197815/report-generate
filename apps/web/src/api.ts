import axios from 'axios';
import { getApiBaseURL } from './lib/deployBase';

export const api = axios.create({
  baseURL: getApiBaseURL(),
});
