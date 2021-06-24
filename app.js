const fetch = require('node-fetch')
const md5 = require('md5')
const poll = require("easy-polling")
const axios = require("axios")
const express = require('express')
const cors = require('cors')
const setCookie = require('set-cookie-parser')
const Str = require('@supercharge/strings')
const random = (min, max) => Math.floor(Math.random() * (max - min)) + min


const corsOptions = {
    origin: '*',
    optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

// global in memory cookie store
let cookieStore = {}

const app = express()
app.use(cors())
const port = process.env.PORT || 3000

/**
* get a new temporary email which can be used to register
* a testing account
*/
async function fetchNewAuthenticationCookie() {
    const requestOptions = {
        "method": "GET",
        "headers": {
            "x-rapidapi-key": process.env.RAPID_API_KEY || 'NOT_SET_API-KEY',
            "x-rapidapi-host": "privatix-temp-mail-v1.p.rapidapi.com",
            "useQueryString": true,
        }
    }
    let email = "not_generated_yet"
    const password = Str.random(20)

    try {
        const domainResponse = await fetch("https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/", requestOptions)
        const domains = await domainResponse.json()

        if (domains.length <= 0) {
            console.error("No domains available from rapid api")
        }

        // handle failure
        const domain = domains[Math.floor(Math.random() * domains.length)]
        const name = Str.random(random(10, 20))
        email = name + domain
    } catch (error) {
        console.error("failed creating temporary email address: ", error)
        res.status(502)
        res.json({ "error": "Unable to generate a temporary email" })
        return
    }

    console.log("Registering: ", email)
    await registerNewUser(email, password)

    // introduce polling here
    const emailMd5 = md5(email)
    try {
        const fnAsyncTask = async () => {
            console.log("$")
            return await axios.get("https://privatix-temp-mail-v1.p.rapidapi.com/request/mail/id/" + emailMd5 + "/", requestOptions)
        }
        const fnValidate = (result) => {
            return result.data.length > 0
        }
        console.log("started polling email inbox")
        const confirmationEmailResponse = await poll(fnAsyncTask, fnValidate, 1000, 20000)
        console.log("finished polling email inbox")
        const confirmationEmails = confirmationEmailResponse.data
        const confirmUrlReg = /https:\/\/login\.bernerzeitung\.ch\/email\/activate\?token=([a-zA-Z0-9\~\!\@\#\$\%\^\&\*\(\)_\-\=\+\\\/\?\.\:\;\'\,]*)?/gm
        const emailText = confirmationEmails[0].mail_text
        const ulrs = emailText.match(confirmUrlReg)
        if (ulrs.length > 0) {
            console.log("confirming email", ulrs[0])
            await fetch(ulrs[0])
        } else {
            console.error("No confirmation url found in latest email")
        }
    } catch (error) {
        const message = "Unable to confirm  " + email + ": "
        console.error(message, error)
        res.status(502)
        res.json({ "error": message })
        return
    }

    const loginTicket = await loginUser(email, password)
    console.log("ticket is:", loginTicket)
    const serviceTicketUrl = await redeemLoginTicket(loginTicket)
    console.log("service ticket url is:", serviceTicketUrl)
    const authCookies = await redeemServiceTicket(serviceTicketUrl)
    console.log("auth cookies are:", authCookies)

    return authCookies
}

/**
 * register a new user using a temporary email address
 * @param {*} email 
 */
async function registerNewUser(email, password) {
    try {
        await fetch("https://login.bernerzeitung.ch/api/user/register?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185", {
            "headers": {
                "accept": "*/*",
                "accept-language": "de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                "content-type": "application/json",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Microsoft Edge\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            },
            "referrer": "https://login.bernerzeitung.ch/register/password?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Famokfahrt-oder-notwehr-an-der-kurdendemo-autofahrer-vor-gericht-862735769185",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "{\"email\":\"" + email + "\",\"password\":\"" + password + "\"}",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        })
    } catch (error) {
        const message = "failed to signup with temporary email address " + email
        console.error(message + ": ", error)
        res.status(502)
        res.json({ "error": message })
        return
    }
}

/**
 * login and receive a login ticket
 * @param {*} username 
 */
async function loginUser(username, password) {
    // handle failure
    try {
        console.log("logging in as " + username)
        const response = await fetch("https://login.bernerzeitung.ch/api/user/loginticket?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900", {
            "headers": {
                "accept": "*/*",
                "accept-language": "de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                "content-type": "application/json",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Microsoft Edge\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "empty",
                "sec-fetch-mode": "cors",
                "sec-fetch-site": "same-origin"
            },
            "referrer": "https://login.bernerzeitung.ch/?callerUri=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900&referrer=https%3A%2F%2Fwww.bernerzeitung.ch%2Fdie-legendaere-macht-des-obersten-bauern-droht-zu-schwinden-309032604900",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": "{\"login\":\"" + username + "\",\"password\":\"" + password + "\",\"serviceId\":\"bernerzeitung\"}",
            "method": "POST",
            "mode": "cors",
            "credentials": "include"
        })
        const respBody = await response.json()
        if (!('login_ticket' in respBody)) {
            console.error("Missing the login_ticket from the login post request")
        }

        return respBody.login_ticket
    } catch (error) {
        console.error("failed logging in: ", email, error)
        res.status(502)
        res.json({ "error": "failed logging in with " + email })
        return
    }
}

/**
 * Turn the login_ticket into a service ticket url
 * @param {*} login_ticket 
 * @returns 
 */
async function redeemLoginTicket(login_ticket = "") {
    try {
        const resp = await fetch("https://cre-api.tamedia.ch/cre-1.0/api/auth_v2/session?login_ticket=" + login_ticket + "&service_id=bernerzeitung&success_url=http%3A%2F%2Fwww.bernerzeitung.ch%2Fso-viel-heisse-luft-macht-mich-krank-355648682083&failure_url=https%3A%2F%2Flogin.bernerzeitung.ch/_error&remember_me=true", {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Microsoft Edge\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "cross-site",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1",
                "Access-Control-Expose-Headers": "Location"
            },
            "referrer": "https://login.bernerzeitung.ch/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include",
            "redirect": "manual"
        })

        if (!resp.headers.get("Location")) {
            const message = "Missing the Location header from the session request"
            console.error(message)
            throw new Error(message)
        }

        return resp.headers.get("Location")

    } catch (error) {
        console.error("Uanble to redeem login ticket", error)
        res.status(502)
        res.json({ "error": "failed redeeming login ticket" })
        return
    }
}


/**
 * redeem the service ticket and receive the global
 * authentication cookie "cresid"
 * @param {*} url Url to fetch the cresid cookie from
 * @returns 
 */
async function redeemServiceTicket(url = "") {
    try {
        const resp = await fetch(url, {
            "headers": {
                "accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8,application/signed-exchange;v=b3;q=0.9",
                "accept-language": "de,de-DE;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6",
                "sec-ch-ua": "\" Not;A Brand\";v=\"99\", \"Microsoft Edge\";v=\"91\", \"Chromium\";v=\"91\"",
                "sec-ch-ua-mobile": "?0",
                "sec-fetch-dest": "document",
                "sec-fetch-mode": "navigate",
                "sec-fetch-site": "cross-site",
                "sec-fetch-user": "?1",
                "upgrade-insecure-requests": "1"
            },
            "referrer": "https://login.bernerzeitung.ch/",
            "referrerPolicy": "strict-origin-when-cross-origin",
            "body": null,
            "method": "GET",
            "mode": "cors",
            "credentials": "include",
            "redirect": "manual"
        })

        if (!resp.headers.get('set-cookie')) {
            const message = "Missing the 'set-cookie' header from the service ticket request"
            console.error(message)
            throw new Error(message)
        }

        return resp.headers.get('set-cookie')

    } catch (error) {
        console.error("Uanble to redeem service ticket", error)
        res.status(502)
        res.json({ "error": "failed redeeming service ticket" })
        return
    }
}

app.get('/', async (req, res) => {
    const cookieMaxDaysAge = parseInt(process.env.COOKIE_MAX_DAYS_AGE) || 5
    // that number should more or less ensure that we stay  in the
    // rapid api freemium model. Per se a cookie can  be used by multiple people at once
    const cookieStoreMaxSize = parseInt(process.env.COOKIE_STORE_MAX_SIZE) || 15

    const todayStamp = Date.now()
    cookieStore = Object.keys(cookieStore)
        .filter(key => key > todayStamp)
        .reduce((obj, key) => {
            obj[key] = cookieStore[key]
            return obj
        }, {})

    if (Object.keys(cookieStore).length <= cookieStoreMaxSize) {
        try {
            const setCookieString = await fetchNewAuthenticationCookie()
            const splitCookieHeaders = setCookie.splitCookiesString(setCookieString)
            const parsedCookies = setCookie.parse(splitCookieHeaders)
            expiration = new Date()
            expiration.setTime(expiration.getTime() + cookieMaxDaysAge * 86400000)
            cookieStore[expiration.getTime()] = parsedCookies

        } catch (err) {
            console.error(err)
            res.status(418)
            res.json({ error: "I'm a teapot" })
        }
    }

    const cookieCandidates = Object.keys(cookieStore)
    let randomCookieKey = cookieCandidates[Math.floor(Math.random() * cookieCandidates.length)]
    res.contentType('application/json')
    res.json(cookieStore[randomCookieKey])
})

app.listen(port, () => {
    console.log(`BZ cookie eater listening at http://localhost:${port}`)
})
