import { createApp } from './app.js';
import { config } from './config.js';
import { createStore } from './store/index.js';
import { precomputeEmbeddings } from './ai/gemini.js';
import { approvedContent } from '../domain/approvedContent.js';

const store = createStore();
await store.init();

precomputeEmbeddings(
  approvedContent.map((c) => `${c.title} ${c.module} ${c.section} ${c.tags.join(' ')} ${c.content}`),
);

const app = createApp(store);
app.listen(config.port, () => {
  console.log(`Agentic Scale API listening on http://127.0.0.1:${config.port}`);
});
