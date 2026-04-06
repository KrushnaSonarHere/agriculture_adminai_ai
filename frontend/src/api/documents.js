import api from './index';

export const getDocuments = (userId) => api.get(`/documents/${userId}`);

export const uploadDocument = (userId, formData) =>
  api.post(`/documents/upload/${userId}`, formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const deleteDocument = (docId) => api.delete(`/documents/${docId}`);
