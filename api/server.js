const createApp = require('./src/app');
const pino = require('pino');

const logger = pino({ name: 'asp-api' });
const PORT = process.env.PORT || 8080;

const app = createApp();

app.listen(PORT, () => {
  logger.info(`ASP API Service listening on port ${PORT}`);
});
