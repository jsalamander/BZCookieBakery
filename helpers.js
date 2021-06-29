const Sentry = require('@sentry/node');
const fetch = require('node-fetch');

/**
 * register a new user using a temporary email address
 * @param {*} email, password, res
 */
async function registerNewUser(email, password, res) {
  try {
    await fetch('https://login.bernerzeitung.ch/api/user/register?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185', {
      headers: {
        accept: '*/*',
        'accept-language': 'de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'content-type': 'application/json',
        'sec-ch-ua': '" Not;A Brand";v="99", "Microsoft Edge";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      referrer: 'https://login.bernerzeitung.ch/register/password?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185',
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `{"email":"${email}","password":"${password}"}`,
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    });
  } catch (error) {
    Sentry.captureException(error);
    const message = `failed to signup with temporary email address ${email}`;
    console.error(`${message}: `, error);
    res.status(502);
    res.json({ error: message });
  }
}

/**
 * login and receive a login ticket
 * @param {*} username
 */
async function loginUser(username, password, res) {
  // handle failure
  try {
    console.info(`logging in as ${username}`);
    const response = await fetch('https://login.bernerzeitung.ch/api/user/loginticket?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900', {
      headers: {
        accept: '*/*',
        'accept-language': 'de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'content-type': 'application/json',
        'sec-ch-ua': '" Not;A Brand";v="99", "Microsoft Edge";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
      },
      referrer: 'https://login.bernerzeitung.ch/?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900',
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: `{"login":"${username}","password":"${password}","serviceId":"bernerzeitung"}`,
      method: 'POST',
      mode: 'cors',
      credentials: 'include',
    });
    const respBody = await response.json();
    if (!('login_ticket' in respBody)) {
      console.error('Missing the login_ticket from the login post request');
    }

    /* eslint-disable-next-line camelcase */
    return respBody.login_ticket;
  } catch (error) {
    Sentry.captureException(error);
    console.error('failed logging in: ', username, error);
    res.status(502);
    res.json({ error: `failed logging in with ${username}` });
  }
}

/**
 * Turn the login_ticket into a service ticket url
 * @param {*} login_ticket
 * @returns
 */
async function redeemLoginTicket(loginTicket = '', res) {
  try {
    const resp = await fetch(`https://cre-api.tamedia.ch/cre-1.0/api/auth_v2/session?login_ticket=${loginTicket}&service_id=bernerzeitung&success_url=http%3A%2F%2Fwww.bernerzeitung.ch%2Fso-viel-heisse-luft-macht-mich-krank-355648682083&failure_url=https%3A%2F%2Flogin.bernerzeitung.ch/_error&remember_me=true`, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'sec-ch-ua': '" Not;A Brand";v="99", "Microsoft Edge";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
        'Access-Control-Expose-Headers': 'Location',
      },
      referrer: 'https://login.bernerzeitung.ch/',
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: null,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      redirect: 'manual',
    });

    if (!resp.headers.get('Location')) {
      const message = 'Missing the Location header from the session request';
      console.error(message);
      throw new Error(message);
    }

    return resp.headers.get('Location');
  } catch (error) {
    Sentry.captureException(error);
    console.error('Uanble to redeem login ticket', error);
    res.status(502);
    res.json({ error: 'failed redeeming login ticket' });
  }
}

/**
 * redeem the service ticket and receive the global
 * authentication cookie "cresid"
 * @param {*} url Url to fetch the cresid cookie from
 * @returns
 */
async function redeemServiceTicket(url = '', res) {
  try {
    const resp = await fetch(url, {
      headers: {
        accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9',
        'accept-language': 'de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
        'sec-ch-ua': '" Not;A Brand";v="99", "Microsoft Edge";v="91", "Chromium";v="91"',
        'sec-ch-ua-mobile': '?0',
        'sec-fetch-dest': 'document',
        'sec-fetch-mode': 'navigate',
        'sec-fetch-site': 'cross-site',
        'sec-fetch-user': '?1',
        'upgrade-insecure-requests': '1',
      },
      referrer: 'https://login.bernerzeitung.ch/',
      referrerPolicy: 'strict-origin-when-cross-origin',
      body: null,
      method: 'GET',
      mode: 'cors',
      credentials: 'include',
      redirect: 'manual',
    });

    const cresidStr = resp.headers.get('set-cookie');
    if (!cresidStr) {
      const message = "Missing the 'set-cookie' header from the service ticket request";
      console.error(message);
      throw new Error(message);
    }

    if (!cresidStr.includes('cresid')) {
      const message = 'The auth cookies do not contain cresid';
      console.error(message);
      throw new Error(message);
    }

    return cresidStr;
  } catch (error) {
    Sentry.captureException(error);
    console.error('Uanble to redeem service ticket', error);
    res.status(502);
    res.json({ error: 'failed redeeming service ticket' });
  }
}

module.exports = {
  registerNewUser, loginUser, redeemLoginTicket, redeemServiceTicket,
};
