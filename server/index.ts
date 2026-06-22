import cors from 'cors';
import 'dotenv/config';
import express from 'express';
import { heroes, items } from './mockApiData.js';

const app = express();
const port = Number(process.env.PORT ?? 3001);

app.use(cors());
app.use(express.json());

app.get('/api/health', (_request, response) => response.json({ ok: true }));
app.get('/api/heroes', (_request, response) => response.json({ data: heroes, source: 'mock' }));
app.get('/api/items', (_request, response) => response.json({ data: items, source: 'mock' }));

app.post('/api/sync/deadlock-data', (_request, response) => {
  response.status(501).json({
    message: 'External Deadlock data sync is intentionally stubbed until a trusted API source and Supabase credentials are configured.',
    recommendedSchedule: 'weekly',
  });
});

// APIからデータを取得する
// 開発時はデータを保存せず、フロントエンドに返す
app.get('/api/sync/deadlock-data-first', async (_request, response) => {
  try {
    // item、hero、assetsのデータを並列で取得する
    const [itemsData, heroesData, assetsData] = await Promise.all([
      fetchDeadlockData('items'),
      fetchDeadlockData<RawHeroData>('heroes'),
      fetchDeadlockData('assets'),
    ]);

    // それぞれのデータを整形する関数を呼び出す
    const formattedHeroesData = formatHeroData(heroesData);

    response.json({
      items: itemsData,
      heroes: formattedHeroesData,
      assets: assetsData,
    });
  } catch (error) {
    console.error(`データ取得中にエラーが発生しました。: ${error}`);
    response.status(500).json({
      error: `データの取得に失敗しました。${error}`,
    });
  }
});

type DeadlockDataType = 'items' | 'heroes' | 'assets';

async function fetchDeadlockData<T = JsonValue>(item: DeadlockDataType): Promise<T> {

  // 引数に渡したタイプのデータを取得する
  const res = await fetch(`https://deadlock.io/api/v1/${item}.json`);
  if (!res.ok){
    throw new Error(`${item}のデータ取得に失敗しました。`)
  }
  return res.json() as Promise<T>;
}

type JsonValue =
  | string
  | number
  | boolean
  | null
  | JsonValue[]
  | { [key: string]: JsonValue };

interface RawHeroData {
  heroes: Array<{
    heroId: string;
    displayName: {
      english: string;
      byLanguage: {
        japanese: string;
      };
    };
    stats: { [key: string]: JsonValue };
  }>;
}

interface FormattedHeroData {
  id: string;
  name: {
    en: string;
    ja: string;
  };
  stats: { [key: string]: JsonValue };
}


function formatHeroData(rawData: RawHeroData): FormattedHeroData[] {
  // ここで生データをフロントエンドで表示する形に整形する
  const formattedData = rawData.heroes.map((hero) => ({
    id: hero.heroId,
    name: {
      en: hero.displayName.english,
      ja: hero.displayName.byLanguage.japanese,
    },
    stats:hero.stats,
  }));
  console.log('Formatted hero data:', formattedData); // 整形後のデータをログに出力して確認する
  return formattedData;
}

app.listen(port, () => {
  console.log(`Deadlock build simulator API listening on http://localhost:${port}`);
});
