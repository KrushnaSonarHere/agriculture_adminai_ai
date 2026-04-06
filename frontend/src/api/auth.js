import api from './index';

export const loginUser = (credential, password) =>
  api.post('/auth/login', { credential, password });

export const registerUser = (data) =>
  api.post('/auth/register', data);

export const registerAdmin = (data) =>
  api.post('/auth/register-admin', data);
