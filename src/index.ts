import express from 'express';
import { identity } from './controllers/identityController';

const app = express();
const port = 3000;
app.use(express.json());

app.post('/identity', identity);

app.listen(port, () => {
  console.log(`Example app listening at http://localhost:${port}`);
});