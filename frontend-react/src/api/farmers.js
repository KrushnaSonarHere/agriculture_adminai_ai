import api from './index';

export const getFarmers      = ()          => api.get('/farmers/');
export const getFarmerById   = (id)        => api.get(`/farmers/${id}`);
export const updateFarmer    = (id, data)  => api.patch(`/farmers/${id}`, data);

// Full profile (used by registration wizard + profile page)
export const saveProfile  = (userId, data) => api.post(`/farmers/profile/${userId}`, data);
export const getProfile   = (userId)       => api.get(`/farmers/profile/${userId}`);

// Documents (list for this user)
export const getFarmerDocuments = (userId) => api.get(`/documents/${userId}`);
