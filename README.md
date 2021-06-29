![GitHub](https://img.shields.io/github/license/jsalamander/BZCookieBakery)

# BZCookieBakery
Bake www.bernerzeitung.ch cookies which can be used to get bypass the paywall with the accompanying browser extensions.

This is the api for https://github.com/jsalamander/BZCookieBear

Deployment: https://bz-cookie-bakery.herokuapp.com/ (Hosted on Heroku using Free Dynos which have to boot on the initial request)


## Configuration

There are some env variables that mus be set.

### Required

`RAPID_API_KEY`: The API key for your https://rapidapi.com/Privatix/api/temp-mail access

### Optional

`COOKIE_STORE_MAX_SIZE`: Default `15` Defines how many cookies will be cached in RAM and randomly reused

`COOKIE_MAX_DAYS_AGE`: Default `5` Defines how many days cookies remain valid in the cache

`POLL_FREQUENCY_MS`: Default `1000` Frequency in Millseconds for polling the confirmation email from RapidAPI

`POLL_TIMEOUT_MS`: Default `20000` Max Milliseconds for trying to poll the confirmation email

`SENTRY_DSN`: Default `false` DSN of your Sentry host. If not set, Sentry is not activated

# Run It

1. Clone this repository `git clone https://github.com/jsalamander/BZCookieBakery.git`
2. Install the dependencies `npm i`
3. Run it `node app.js`
