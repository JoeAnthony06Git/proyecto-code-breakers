import { approvedContent } from './src/domain/approvedContent.js';
import { precomputeEmbeddings } from './src/server/ai/gemini.js';
import { createApp } from './src/server/app.js';
import { createStore } from './src/server/store/index.js';

const store = createStore();
await store.init();

await precomputeEmbeddings(
  approvedContent.map((c) => `${c.title} ${c.module} ${c.section} ${c.tags.join(' ')} ${c.content}`),
);

const app = createApp(store);

export default app;
