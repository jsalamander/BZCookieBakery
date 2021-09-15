<p align="center" >
  <img height="300rem" src="https://raw.githubusercontent.com/jsalamander/BZCookieBakery/main/assets/cookies.png" alt="Cookies"/>
</p>
<a href='https://de.freepik.com/fotos-vektoren-kostenlos/lebensmittel'>Lebensmittel Vektor erstellt von catalyststuff - de.freepik.com</a>


![Pipeline](https://github.com/jsalamander/BZCookieBakery/actions/workflows/release.yml/badge.svg)
![GitHub](https://img.shields.io/github/license/jsalamander/BZCookieBakery)
![Docker Pulls](https://img.shields.io/docker/pulls/jfriedli/bz-cookie-bakery)

# BZCookieBakery
Bake cookies which can be used to bypass the paywall of many Tamedia websites with the accompanying browser extensions.

You'll find a list of the supported websites below

This is the api for https://github.com/jsalamander/BZCookieBear

## Container

A container image is availabe on [DockerHub](https://hub.docker.com/r/jfriedli/bz-cookie-bakery/tags?page=1&ordering=last_updated)

## API Docs

Domain: https://www.bzcookie.fans/ (note due to Heroku and bad DNS provider only a subdomain works)

### Cookie Endpoint
**Path**: `/`
**Method**: `GET` 

**Optional Query Parameter**:

 `/?hostname=www.thunertagblatt.ch` Returns cookies for that specified page. Defaults to `www.bernerzeitung.ch`

The `hostname` is accesible by the js variable `window.location.hostname` on the client's browser.

List of supported `hostnames`
* www.bernerzeitung.ch
* www.24heures.ch
* www.bazonline.ch
* www.berneroberlaender.ch
* www.tagesanzeiger.ch
* www.derbund.ch
* www.landbote.ch
* www.langenthalertagblatt.ch
* www.zsz.ch
* www.thunertagblatt.ch
* www.tdg.ch
* www.zuonline.ch


**Example Response**
```json
[
   {
      "name":"creid",
      "value":"1704611014491416240",
      "expires":"2037-12-31T23:55:55.000Z",
      "domain":"zsz.ch",
      "path":"/",
      "httpOnly":true,
      "sameSite":"Lax"
   },
   {
      "name":"cresid",
      "value":"2840c0e4448b43cb783c3adc7fd9a707",
      "expires":"2037-12-31T23:55:55.000Z",
      "domain":".zsz.ch",
      "path":"/",
      "secure":true,
      "httpOnly":true,
      "sameSite":"None"
   }
]
```

## Configuration

There are some env variables that mus be set.

### Required

`RAPID_API_KEY`: The API key for your https://rapidapi.com/Privatix/api/temp-mail access

### Optional

`PORT`: Default `3000` the port the express server listens on

`COOKIE_STORE_MAX_SIZE`: Default `15` Defines how many cookies will be cached in RAM and randomly reused

`COOKIE_MAX_DAYS_AGE`: Default `5` Defines how many days cookies remain valid in the cache

`POLL_FREQUENCY_MS`: Default `1000` Frequency in Millseconds for polling the confirmation email from RapidAPI

`POLL_TIMEOUT_MS`: Default `20000` Max Milliseconds for trying to poll the confirmation email

`SENTRY_DSN`: Default `false` DSN of your Sentry host. If not set, Sentry is not activated

# Run It

1. Clone this repository `git clone https://github.com/jsalamander/BZCookieBakery.git`
2. Install the dependencies `npm i`
3. Run it `node app.js`
