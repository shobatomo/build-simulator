import type { AssetIcons, Hero, Item } from '../types';

interface ApiResponse<T> {
  data: T;
  source: string;
}

interface DeadlockDataResponse {
  heroes: Hero[];
  items: Item[];
  assets: {
    icons: AssetIcons;
    source: string;
  };
}

const getJson = async <T>(path: string): Promise<T> => {
  const response = await fetch(path);

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status} ${response.statusText}`);
  }

  return response.json() as Promise<T>;
};

export const fetchHeroes = async () => {
  const response = await getJson<ApiResponse<Hero[]>>('/api/heroes');
  return response.data;
};

export const fetchItems = async () => {
  const response = await getJson<ApiResponse<Item[]>>('/api/items');
  return response.data;
};

export const fetchDeadlockData = () =>
  getJson<DeadlockDataResponse>('/api/sync/deadlock-data-first');
