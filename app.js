const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const cron = require('node-cron');
const log = require('simple-node-logger').createSimpleLogger();
const helpers = require('./helpers');

log.setLevel(process.env.NODE_ENV === 'production' ? 'info' : 'debug');

// every 8th hour
const defaultCron = process.env.CRON_COOKIE_FETCH_EXPR || '0 */8 * * *';

if (process.env.SENTRY_DSN || false) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

// global in memory cookie store
let cookieStore = {};

cron.schedule(defaultCron, async () => {
  cookieStore = await helpers.bakeCookies(cookieStore, log);
});

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  res.contentType('application/json');
  const todayStamp = Date.now();
  cookieStore = Object.keys(cookieStore)
    .filter((key) => key > todayStamp)
    .reduce((obj, key) => {
      /* eslint-disable-next-line no-param-reassign */
      obj[key] = cookieStore[key];
      return obj;
    }, {});

  const cookieCandidates = Object.keys(cookieStore);
  const randomCookieKey = cookieCandidates[Math.floor(Math.random() * cookieCandidates.length)];
  res.json(cookieStore[randomCookieKey] || []);
});

app.listen(port, async () => {
  log.info(`BZCookieBakery taking orders at http://localhost:${port}`);
  log.info('starting initial bakery cookie fetch jobs');
  cookieStore = await helpers.bakeCookies(cookieStore, log);
  log.debug('initial cookie store', cookieStore);
});
