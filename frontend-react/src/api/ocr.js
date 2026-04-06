import api from './index';

// PaddleOCR process a document
export const runOcr            = (docId) => api.post(`/ocr/process/${docId}`);

// AI Comparison & Decision for a farmer
export const analyzeFarmer     = (userId, appId = null) => 
  api.post(`/ocr/analyze/${userId}${appId ? `?application_id=${appId}` : ''}`);

// Get all AI results for a farmer (OCR fields + comparison)
export const getOcrResult      = (userId) => api.get(`/ocr/result/${userId}`);

// Get latest AI decision for a farmer
export const getAiDecision     = (userId) => api.get(`/ocr/decision/${userId}`);

// Admin list: all AI decisions
export const getAllDecisions   = () => api.get('/ocr/all-decisions');

// Admin override: approve/reject/flag
export const updateAiDecision  = (decisionId, data) => 
  api.put(`/ocr/decision/${decisionId}`, data);

// Master Prompt: Analyze raw OCR text directly
export const analyzeRawText    = (ocrText, docTypeHint = null, userId = null) => 
  api.post('/ocr/analyze-text', { ocr_text: ocrText, doc_type_hint: docTypeHint, user_id: userId });
