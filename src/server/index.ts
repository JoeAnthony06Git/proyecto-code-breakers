import { createApp } from './app';
import { config } from './config';
import { createStore } from './store';
import { precomputeEmbeddings } from './ai/gemini';
import { approvedContent } from '../domain/approvedContent';

const store = createStore();
await store.init();

precomputeEmbeddings(
  approvedContent.map((c) => `${c.title} ${c.module} ${c.section} ${c.tags.join(' ')} ${c.content}`),
);

const app = createApp(store);
app.listen(config.port, () => {
  console.log(`Agentic Scale API listening on http://127.0.0.1:${config.port}`);
});
