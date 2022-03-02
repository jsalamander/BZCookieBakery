const Sentry = require('@sentry/node');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const Str = require('@supercharge/strings');
const md5 = require('md5');
const poll = require('easy-polling');
const axios = require('axios');

const puppeteerTimeout = parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 10000;
const emailInputSelector = '#email';
const nextBtnSelector = '#first-step-continue-btn';
const passwordInputSelector = 'input[type=password]';
const submitPasswordBtnSelector = '#native-register-btn';
const submitLoginBtnSelector = '#native-login-btn';
const profileUrl = 'https://profile.onelog.ch/';
const visibleSelectorOption = { visible: true };

// Google analytics cookie name parts, we don't want to track
const forbiddenCookienameParts = ['_gat', '_ga', '_gid'];

const requestOptions = {
  method: 'GET',
  headers: {
    'x-rapidapi-key': process.env.RAPID_API_KEY || 'NOT_SET_API-KEY',
    'x-rapidapi-host': 'privatix-temp-mail-v1.p.rapidapi.com',
    useQueryString: true,
  },
};

/**
 * register a new account using the provided credentials
 * The registration process will be done using puppeteer
 * @param {*} email
 * @param {*} password
 */
async function registerAccount(email, password) {
  const browser = await puppeteer.launch({ headless: process.env.NODE_ENV === 'production' });
  const page = await browser.newPage();
  page.setDefaultTimeout(puppeteerTimeout);

  await page.goto(profileUrl);
  await page.waitForSelector(emailInputSelector, visibleSelectorOption);

  await page.type(emailInputSelector, email);

  await page.waitForSelector(nextBtnSelector, visibleSelectorOption);
  await Promise.all([
    page.waitForNavigation(),
    page.click(nextBtnSelector),
  ]);

  await page.waitForSelector(passwordInputSelector, visibleSelectorOption);
  await page.type(passwordInputSelector, password);

  await Promise.all([
    page.waitForNavigation(),
    page.click(submitPasswordBtnSelector),
  ]);
  await browser.close();
}

/**
 * Visit confirm url and login to receieve cookies
 * @param {*} confirmUrl
 * @param {*} email
 * @param {*} password
 * @returns
 */
async function confirmAccount(confirmUrl, email, password) {
  const browser = await puppeteer.launch({ headless: process.env.NODE_ENV === 'production' });
  const page = await browser.newPage();
  page.setDefaultTimeout(puppeteerTimeout);

  await page.goto(confirmUrl);
  await page.goto(profileUrl);

  await page.waitForSelector(emailInputSelector, visibleSelectorOption);
  await page.type(emailInputSelector, email);

  await Promise.all([
    page.waitForNavigation(),
    page.click(nextBtnSelector),
  ]);

  await page.waitForSelector(passwordInputSelector, visibleSelectorOption);
  await page.type(passwordInputSelector, password);

  await Promise.all([
    page.waitForNavigation(),
    page.click(submitLoginBtnSelector),
  ]);

  await page.waitForFunction(
    `document.querySelector("body").innerText.includes("${email}")`,
  );

  const cookies = await page.cookies();
  await browser.close();
  return cookies;
}

/**
 * generate a new email account
 * @returns
 */
async function getNewEmailAccount() {
  try {
    const domainResponse = await fetch('https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/', requestOptions);
    const domains = await domainResponse.json();

    if (domains.length <= 0) {
      throw new Error('RapidAPI returned zero email domains');
    }

    const tempEmailDomain = domains[Math.floor(Math.random() * domains.length)];
    const name = Math.random().toString(36).substr(2, 5);
    const email = name + tempEmailDomain;

    // satisfy formal password requirements
    const password = `Aa1${Str.random(20)}`;
    return { email, password };
  } catch (error) {
    throw new Error(`Unable to fetch email domain list with: ${error}`);
  }
}

/**
 * confirm the email address and therefore the account
 * @param {*} email
 * @returns
 */
async function receiveConfirmationEmail(email) {
  const emailMd5 = md5(email);
  const fnAsyncTask = async () => {
    try {
      return await axios.get(`https://privatix-temp-mail-v1.p.rapidapi.com/request/mail/id/${emailMd5}/`, requestOptions);
    } catch (error) {
      Sentry.captureException(error);
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
    throw new Error('Never received a confirmation email');
  }

  /* eslint-disable-next-line no-useless-escape */
  const confirmUrlReg = /\[https:\/\/id\.onelog\.ch\/native\/email-verification(.*?)\]/g;
  const emailText = confirmationEmails[0].mail_text;
  const urls = emailText.match(confirmUrlReg);
  if (urls.length > 0) {
    const confirmUrl = urls[0].replace('[', '').replace(']', '');
    return confirmUrl;
  }
  throw new Error('No confirmation url found in latest email');
}

/**
 * Filter out all nasty Goggle Analytics cookies
 * @param {*} cookies
 */
function filterCookies(cookies) {
  return cookies?.filter((cookie) => !forbiddenCookienameParts.some(
    (forbiddenCookieNamePart) => cookie?.name.includes(forbiddenCookieNamePart),
  ));
}

/**
 * try to register and retrieve a onelog.ch cookie
 */
async function popluateCookies() {
  let emailCreds = {};
  try {
    emailCreds = await getNewEmailAccount();
  } catch (error) {
    Sentry.captureException(error);
    throw new Error('failed creating temporary email address: ', error);
  }

  try {
    await registerAccount(emailCreds.email, emailCreds.password);
  } catch (error) {
    Sentry.captureException(error);
    throw new Error('failed registering account on onelog: ', error);
  }

  let confirmUrl = null;
  try {
    confirmUrl = await receiveConfirmationEmail(emailCreds.email);
    if (confirmUrl?.length < 1) {
      throw new Error(`Got invalid confirm Url from email: ${confirmUrl}`);
    }
  } catch (error) {
    Sentry.captureException(error);
    throw new Error(`Unable to confirm  ${emailCreds.email}: `, error);
  }

  try {
    const cookies = await confirmAccount(
      confirmUrl,
      emailCreds.email,
      emailCreds.password,
    );
    return filterCookies(cookies);
  } catch (error) {
    Sentry.captureException(error);
    throw new Error(`Unable to confirm  ${emailCreds.email}: `, error);
  }
}

async function bakeCookies(cookieStore, log) {
  const tmpCookieStore = { ...cookieStore };
  let triesCounter = 0;
  const maxRetries = parseInt(process.env.BAKERY_RETIRES, 10) || 3;
  while (triesCounter < maxRetries) {
    log.info(`bakery try #${triesCounter}`);
    try {
      /* eslint-disable-next-line no-await-in-loop */
      const cookies = await popluateCookies();
      const expiration = new Date();
      const cookieMaxDaysAge = parseInt(process.env.COOKIE_MAX_DAYS_AGE, 10) || 5;
      expiration.setTime(expiration.getTime() + cookieMaxDaysAge * 86400000);
      tmpCookieStore[expiration.getTime()] = cookies;
      log.info('successfully fetched account cookies');
      return tmpCookieStore;
    } catch (err) {
      log.warn(`Fetching cookies failed at try ${triesCounter} with ${err}`);
    }
    triesCounter += 1;
  }
}

module.exports = {
  bakeCookies,
};
