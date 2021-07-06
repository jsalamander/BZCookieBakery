const fetch = require('node-fetch');
const md5 = require('md5');
const poll = require('easy-polling');
const axios = require('axios');
const express = require('express');
const cors = require('cors');
const setCookie = require('set-cookie-parser');
const Sentry = require('@sentry/node');
const Str = require('@supercharge/strings');
const helpers = require('./helpers');

if (process.env.SENTRY_DSN || false) {
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    tracesSampleRate: 1.0,
  });
}

// global in memory cookie store
const cookieStore = {};

const app = express();
app.use(cors());
const port = process.env.PORT || 3000;

/**
 * get a new temporary email which can be used to register
 * a testing account
 * @param {
 } res
 * @returns authCookies
 */
async function fetchNewAuthenticationCookie(res, domain) {
  const getDomainWithoutSubdomain = (url) => {
    const urlParts = new URL(url).hostname.split('.');

    return urlParts
      .slice(0)
      .slice(-(urlParts.length === 4 ? 3 : 2))
      .join('.');
  };

  const serviceId = getDomainWithoutSubdomain(domain);
  const requestOptions = {
    method: 'GET',
    headers: {
      'x-rapidapi-key': process.env.RAPID_API_KEY || 'NOT_SET_API-KEY',
      'x-rapidapi-host': 'privatix-temp-mail-v1.p.rapidapi.com',
      useQueryString: true,
    },
  };
  let email = 'not_generated_yet';
  const password = Str.random(20);

  try {
    const domainResponse = await fetch('https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/', requestOptions);
    const domains = await domainResponse.json();

    if (domains.length <= 0) {
      console.error('No domains available from rapid api');
      return;
    }

    // handle failure
    const tempEmailomain = domains[Math.floor(Math.random() * domains.length)];
    const name = Math.random().toString(36).substr(2, 5);
    email = name + tempEmailomain;
  } catch (error) {
    console.error('failed creating temporary email address: ', error);
    Sentry.captureException(error);
    res.status(502);
    res.json({ error: 'Unable to generate a temporary email' });
    return;
  }

  console.info('Registering: ', email);
  await helpers.registerNewUser(email, password, res, domain);

  try {
    const emailMd5 = md5(email);
    const fnAsyncTask = async () => {
      try {
        return await axios.get(`https://privatix-temp-mail-v1.p.rapidapi.com/request/mail/id/${emailMd5}/`, requestOptions);
      } catch (error) {
        Sentry.captureException(error);
        console.error(`inbox poll error for ${email}`, error);
        return null;
      }
    };
    const fnValidate = (result) => result?.data?.length > 0;
    const confirmationEmailResponse = await poll(
      fnAsyncTask,
      fnValidate,
      parseInt(process.env.POLL_FREQUENCY_MS, 10) || 1000,
      parseInt(process.env.POLL_TIMEOUT_MS, 10) || 20000,
    );
    const confirmationEmails = confirmationEmailResponse?.data;
    if (!confirmationEmails) {
      res.status(502);
      res.json({ error: 'Never received a confirmation email' });
      return;
    }

    /* eslint-disable-next-line no-useless-escape */
    const confirmUrlReg = /https:\/\/login\.bernerzeitung\.ch\/email\/activate\?token=([a-zA-Z0-9\~\!\@\#\$\%\^\&\*\(\)_\-\=\+\\\/\?\.\:\;\'\,]*)?/gm;
    const emailText = confirmationEmails[0].mail_text;
    const ulrs = emailText.match(confirmUrlReg);
    if (ulrs.length > 0) {
      console.info('confirming email', ulrs[0]);
      await fetch(ulrs[0]);
    } else {
      console.error('No confirmation url found in latest email');
    }
  } catch (error) {
    const message = `Unable to confirm  ${email}: `;
    console.error(message, error);
    Sentry.captureException(error);
    res.status(502);
    res.json({ error: message });
    return;
  }

  const loginTicket = await helpers.loginUser(email, password, res, domain, serviceId);
  console.info('ticket is:', loginTicket);
  const serviceTicketUrl = await helpers.redeemLoginTicket(loginTicket, res, serviceId);
  console.info('service ticket url is:', serviceTicketUrl);
  const authCookies = await helpers.redeemServiceTicket(serviceTicketUrl, res);
  console.info('auth cookies are:', authCookies);

  return authCookies;
}

app.get('/', async (req, res) => {
  res.contentType('application/json');
  const cookieMaxDaysAge = parseInt(process.env.COOKIE_MAX_DAYS_AGE, 10) || 5;
  // that number should more or less ensure that we stay  in the
  // rapid api freemium model. Per se a cookie can  be used by multiple people at once
  const cookieStoreMaxSize = parseInt(process.env.COOKIE_STORE_MAX_SIZE, 10) || 15;

  const domain = req.query.hostname || 'www.bernerzeitung.ch';
  console.info(`working for tamedia service: ${domain}`);

  if (!(domain in cookieStore)) {
    cookieStore[domain] = {};
  }
  const todayStamp = Date.now();
  cookieStore[domain] = Object.keys(cookieStore[domain])
    .filter((key) => key > todayStamp)
    .reduce((obj, key) => {
      /* eslint-disable-next-line no-param-reassign */
      obj[domain][key] = cookieStore[domain][key];
      return obj;
    }, {});

  if (Object.keys(cookieStore[domain]).length <= cookieStoreMaxSize) {
    try {
      const setCookieString = await fetchNewAuthenticationCookie(res, domain);
      const splitCookieHeaders = setCookie.splitCookiesString(setCookieString);
      const parsedCookies = setCookie.parse(splitCookieHeaders);
      const expiration = new Date();
      expiration.setTime(expiration.getTime() + cookieMaxDaysAge * 86400000);
      cookieStore[domain][expiration.getTime()] = parsedCookies;
    } catch (err) {
      Sentry.captureException(err);
      console.error(err);
    }
  }

  const cookieCandidates = Object.keys(cookieStore[domain]);
  const randomCookieKey = cookieCandidates[Math.floor(Math.random() * cookieCandidates.length)];
  if (await helpers.validateCookies(cookieStore[domain][randomCookieKey], res, domain)) {
    res.json(cookieStore[domain][randomCookieKey]);
  } else {
    delete cookieStore[domain][randomCookieKey];
  }
});

app.listen(port, () => {
  console.info(`BZCookieBakery taking orders at http://localhost:${port}`);
});
