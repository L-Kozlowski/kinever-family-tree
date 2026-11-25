import { serverMessage, t } from '../i18n';
import type { FamilyTree, DemoConnection } from '../types';
export type AppState = {
  revision: number;
  trees: FamilyTree[];
  connectionsByTree: Record<string, DemoConnection[]>;
};
export async function request<T>(
  path: string,
  options?: RequestInit,
): Promise<T> {
  const response = await fetch(path, options);
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(
      typeof body?.detail === 'string'
        ? serverMessage(body.detail)
        : t('Błąd serwera ({0}).', response.status),
    );
  }
  return response.json();
}
export const loadState = () => request<AppState>('/api/state');
export const persistState = (state: AppState) =>
  request<{ revision: number }>('/api/state', {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(state),
  });
export async function uploadMedia(file: File) {
  const data = new FormData();
  data.append('file', file);
  return request<import('../types').Attachment>('/api/media', {
    method: 'POST',
    body: data,
  });
}
