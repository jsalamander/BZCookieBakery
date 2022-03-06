const express = require('express');
const cors = require('cors');
const Sentry = require('@sentry/node');
const cron = require('node-cron');
const helpers = require('./helpers');
const log = require('./logger');

// every 8th hour
const defaultCron = process.env.CRON_COOKIE_FETCH_EXPR || '0 */8 * * *';

if (process.env.SENTRY_DSN || false) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

// global in memory credential store
let credentialStore = {};

cron.schedule(defaultCron, async () => {
  credentialStore = await helpers.bake(credentialStore);
});

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

app.get('/', async (req, res) => {
  res.contentType('application/json');
  const todayStamp = Date.now();
  credentialStore = Object.keys(credentialStore || {})
    .filter((key) => key > todayStamp)
    .reduce((obj, key) => {
      /* eslint-disable-next-line no-param-reassign */
      obj[key] = credentialStore[key];
      return obj;
    }, {});

  const credentialCandidates = Object.keys(credentialStore);
  const randomCredentialKey = credentialCandidates[
    Math.floor(Math.random() * credentialCandidates.length)
  ];
  res.json(credentialStore[randomCredentialKey] || []);
});

app.listen(port, async () => {
  log.info(`BZCookieBakery taking orders at http://localhost:${port}`);
  log.info('starting initial bakery job ');
  credentialStore = await helpers.bake(credentialStore);
  log.debug('initial credential store', credentialStore);
});
