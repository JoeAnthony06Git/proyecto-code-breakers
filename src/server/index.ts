import { createApp } from './app';
import { config } from './config';
import { createStore } from './store';

const store = createStore();
await store.init();

const app = createApp(store);
app.listen(config.port, () => {
  console.log(`Agentic Scale API listening on http://127.0.0.1:${config.port}`);
});
