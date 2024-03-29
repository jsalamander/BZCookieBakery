<p align="center" >
  <img height="300rem" src="https://raw.githubusercontent.com/jsalamander/BZCookieBakery/main/assets/cookies.png" alt="Cookies"/>
</p>
<a href='https://de.freepik.com/fotos-vektoren-kostenlos/lebensmittel'>Lebensmittel Vektor erstellt von catalyststuff - de.freepik.com</a>


[![Better Uptime Badge](https://betteruptime.com/status-badges/v1/monitor/cxo0.svg)](https://betteruptime.com/?utm_source=status_badge)
![Pipeline](https://github.com/jsalamander/BZCookieBakery/actions/workflows/release.yml/badge.svg)
![GitHub](https://img.shields.io/github/license/jsalamander/BZCookieBakery)
![Docker Pulls](https://img.shields.io/docker/pulls/jfriedli/bz-cookie-bakery)

# BZCookieBakery
Bake credentials which can be used to bypass the paywall of many OneLog supported news websites with the accompanying browser extensions.

All websites supported by OneLog can be found on their page https://consent.onelog.ch.

This is the api for https://github.com/jsalamander/BZCookieBear

## Container

A container image is availabe on [DockerHub](https://hub.docker.com/r/jfriedli/bz-cookie-bakery/tags?page=1&ordering=last_updated)

## API Docs

Domain: https://www.bzcookie.fans/ (note due to Heroku and bad DNS provider only a subdomain works)

### Credentials Endpoint
**Path**: `/`
**Method**: `GET` 

**Example Response**
```json
{
  "email": "wur2c@subcaro.com",
  "password": "Aa1-xcxnGQwTW-jG2-xeJyH"
}
```

## Configuration

There are some env variables that mus be set.

### Required

`RAPID_API_KEY`: The API key for your https://rapidapi.com/Privatix/api/temp-mail access

### Optional

`PORT`: Default `3000` the port the express server listens on

`COOKIE_MAX_DAYS_AGE`: Default `5` Defines how many days cookies remain valid in the cache

`POLL_FREQUENCY_MS`: Default `1000` Frequency in Millseconds for polling the confirmation email from RapidAPI

`POLL_TIMEOUT_MS`: Default `20000` Max Milliseconds for trying to poll the confirmation email

`SENTRY_DSN`: Default `false` DSN of your Sentry host. If not set, Sentry is not activated

`CRON_COOKIE_FETCH_EXPR`: Default `"0 */8 * * *"` Cron expression at which CookieBakery tries to fetch new cookies

`PUPPETEER_TIMEOUT`: Default `10000` Puppeteer default timeout time in ms

`COOKIE_BANNER_TIMEOUT`: Default `3000` Timeout to wait for Cookie Banner (does not show up in Switzerland 👾)

`BAKERY_LOG_LEVEL`: Default not set. Allows to define the log level as one from `trace, debug, info, warn, error and fatal (plus all and off)`.

# Run It

1. Clone this repository `git clone https://github.com/jsalamander/BZCookieBakery.git`
2. Install the dependencies `npm i`
3. Run it `node app.js`
