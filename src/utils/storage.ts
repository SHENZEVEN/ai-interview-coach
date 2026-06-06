import { HistoryRecord } from '../types';

const STORAGE_KEY = 'ai-interview-history';
const MAX_RECORDS = 200;
const CLEANUP_COUNT = 20;

export const getHistoryRecords = (): HistoryRecord[] => {
  try {
    const data = localStorage.getItem(STORAGE_KEY);
    if (!data) return [];
    return JSON.parse(data);
  } catch {
    return [];
  }
};

export const saveHistoryRecord = (record: HistoryRecord): void => {
  const records = getHistoryRecords();
  records.unshift(record);
  
  // 超出上限，删除最早的记录
  if (records.length > MAX_RECORDS) {
    records.splice(MAX_RECORDS - CLEANUP_COUNT, CLEANUP_COUNT);
  }
  
  localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
};

export const updateHistoryRecord = (id: string, updates: Partial<HistoryRecord>): void => {
  const records = getHistoryRecords();
  const index = records.findIndex(r => r.id === id);
  
  if (index !== -1) {
    records[index] = { ...records[index], ...updates };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(records));
  }
};

export const clearAllHistory = (): void => {
  localStorage.removeItem(STORAGE_KEY);
};

export const exportHistory = (): void => {
  const records = getHistoryRecords();
  const dataStr = JSON.stringify(records, null, 2);
  const blob = new Blob([dataStr], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  
  const a = document.createElement('a');
  a.href = url;
  a.download = `interview-history-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
};

export const getWrongRecords = (): HistoryRecord[] => {
  return getHistoryRecords().filter(r => r.isWrong);
};