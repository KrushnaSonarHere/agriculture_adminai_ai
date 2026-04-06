import api from './index';

export const getSchemes    = ()   => api.get('/schemes/');
export const getSchemeById = (id) => api.get(`/schemes/${id}`);
