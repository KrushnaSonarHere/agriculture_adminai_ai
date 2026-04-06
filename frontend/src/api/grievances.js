import api from './index';

export const getGrievances      = (params)       => api.get('/grievances/', { params });
export const submitGrievance    = (data)         => api.post('/grievances/', data);
export const resolveGrievance   = (id, status, note = '') =>
  api.put(`/grievances/${id}/status?status=${encodeURIComponent(status)}&resolution_note=${encodeURIComponent(note)}`);
export const assignGrievance    = (id, officer)  =>
  api.put(`/grievances/${id}/status?status=Assigned&assigned_to=${encodeURIComponent(officer)}`);
