const Sentry = require('@sentry/node');
const fetch = require('node-fetch');
const puppeteer = require('puppeteer');
const Str = require('@supercharge/strings');
const md5 = require('md5');
const poll = require('easy-polling');
const axios = require('axios');
const UserAgent = require('user-agents');
const log = require('./logger');

const puppeteerTimeout = parseInt(process.env.PUPPETEER_TIMEOUT, 10) || 10000;
const puppeterDefaultOpts = {
  headless: process.env.NODE_ENV === 'production',
  args: [
    '--disable-gpu',
    '--disable-dev-shm-usage',
    '--disable-setuid-sandbox',
    '--no-sandbox',
  ],
};
const emailInputSelector = '#email';
const nextBtnSelector = '#first-step-continue-btn';
const passwordInputSelector = 'input[type=password]';
const submitPasswordBtnSelector = '#native-register-btn';
const submitLoginBtnSelector = '#native-login-btn';
const profileUrl = 'https://profile.onelog.ch/';
const visibleSelectorOption = { visible: true };

const requestOptions = {
  method: 'GET',
  headers: {
    'x-rapidapi-key': process.env.RAPID_API_KEY || 'NOT_SET_API-KEY',
    'x-rapidapi-host': 'privatix-temp-mail-v1.p.rapidapi.com',
    useQueryString: true,
  },
};

const userAgent = new UserAgent();

/**
 * register a new account using the provided credentials
 * The registration process will be done using puppeteer
 * @param {*} email
 * @param {*} password
 */
async function registerAccount(email, password) {
  log.debug('registering account for ', email);
  const browser = await puppeteer.launch(puppeterDefaultOpts);
  const page = await browser.newPage();
  page.setDefaultTimeout(puppeteerTimeout);
  const currUserAgent = userAgent.toString();
  page.setUserAgent(currUserAgent);
  log.debug('user agent register ', userAgent);

  log.debug('go to ', profileUrl);
  await page.goto(profileUrl);
  await page.waitForSelector(emailInputSelector, visibleSelectorOption);

  log.debug('type email ', profileUrl);
  await page.type(emailInputSelector, email);

  await page.waitForSelector(nextBtnSelector, visibleSelectorOption);

  log.debug('proceed to password click');
  await Promise.all([
    page.waitForNavigation(),
    page.click(nextBtnSelector),
  ]);

  log.debug('type password ', password);
  await page.waitForSelector(passwordInputSelector, visibleSelectorOption);
  await page.type(passwordInputSelector, password);

  log.debug('submit password');
  await Promise.all([
    page.waitForNavigation(),
    page.click(submitPasswordBtnSelector),
  ]);

  log.debug('registered account, closing browser ', puppeterDefaultOpts);
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
  const browser = await puppeteer.launch(puppeterDefaultOpts);
  const page = await browser.newPage();
  page.setDefaultTimeout(puppeteerTimeout);
  const currUserAgent = userAgent.toString();
  page.setUserAgent(currUserAgent);
  log.debug('user agent confirming ', currUserAgent);

  log.debug('visit confirm url ', confirmUrl);
  await page.goto(confirmUrl);
  log.debug('visit profile url ', confirmUrl);
  await page.goto(profileUrl);

  log.debug('type email for login ', email);
  await page.waitForSelector(emailInputSelector, visibleSelectorOption);
  await page.type(emailInputSelector, email);

  log.debug('proceed to password page for ', email);
  await Promise.all([
    page.waitForNavigation(),
    page.click(nextBtnSelector),
  ]);

  log.debug('enter login password ', password);
  await page.waitForSelector(passwordInputSelector, visibleSelectorOption);
  await page.type(passwordInputSelector, password);

  log.debug('submit login');
  await Promise.all([
    page.waitForNavigation(),
    page.click(submitLoginBtnSelector),
  ]);

  log.debug('check if login successful');
  await page.waitForFunction(
    `document.querySelector("body").innerText.includes("${email}")`,
  );
  await browser.close();
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

    log.debug('available email domains ', domains);
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
    log.debug('confirmation urls extracted ', urls);
    const confirmUrl = urls[0].replace('[', '').replace(']', '');
    return confirmUrl;
  }
  throw new Error('No confirmation url found in latest email');
}

/**
 * try to register and retrieve a valid onelog.ch account
 */
async function popluateCredentials() {
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
    await confirmAccount(
      confirmUrl,
      emailCreds.email,
      emailCreds.password,
    );
    log.debug('successfully created account ', emailCreds);
    return emailCreds;
  } catch (error) {
    Sentry.captureException(error);
    throw new Error(`Unable to confirm  ${emailCreds.email}: `, error);
  }
}

async function bake(credentialStore) {
  const tmpCredentialStore = { ...credentialStore };
  let triesCounter = 0;
  const maxRetries = parseInt(process.env.BAKERY_RETIRES, 10) || 3;
  while (triesCounter < maxRetries) {
    log.info(`bakery try #${triesCounter}`);
    try {
      /* eslint-disable-next-line no-await-in-loop */
      const credentials = await popluateCredentials();
      const expiration = new Date();
      const cookieMaxDaysAge = parseInt(process.env.COOKIE_MAX_DAYS_AGE, 10) || 5;
      expiration.setTime(expiration.getTime() + cookieMaxDaysAge * 86400000);
      tmpCredentialStore[expiration.getTime()] = credentials;
      log.info('successfully created an account for ', credentials.email);
      return tmpCredentialStore;
    } catch (err) {
      log.warn(`Fetching cookies failed at try ${triesCounter} with ${err}`);
    }
    triesCounter += 1;
  }
}

module.exports = {
  bake,
};
