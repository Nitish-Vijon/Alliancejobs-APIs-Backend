import app from './app';
import { config } from './config';

const server = app.listen(config.port, () => {
  console.log(`Server is running on port ${config.port}`);
});

export default server;