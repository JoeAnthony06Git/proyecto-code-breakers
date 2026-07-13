import { createApp } from './src/server/app';
import { createStore } from './src/server/store';
import { precomputeEmbeddings } from './src/server/ai/gemini';
import { approvedContent } from './src/domain/approvedContent';

const store = createStore();
await store.init();

await precomputeEmbeddings(
  approvedContent.map((c) => `${c.title} ${c.module} ${c.section} ${c.tags.join(' ')} ${c.content}`),
);

const app = createApp(store);

export default app;
