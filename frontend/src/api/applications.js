import api from './index';

export const getApplications    = (params)     => api.get('/applications/', { params });
export const submitApplication  = (data)       => api.post('/applications/', data);
export const approveApplication = (id, remarks = '') =>
  api.patch(`/applications/${id}`, { status: 'Approved',  admin_remarks: remarks });
export const rejectApplication  = (id, remarks = '') =>
  api.patch(`/applications/${id}`, { status: 'Rejected',  admin_remarks: remarks });
export const reviewApplication  = (id, remarks = '') =>
  api.patch(`/applications/${id}`, { status: 'Processing', admin_remarks: remarks });
