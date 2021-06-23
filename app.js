const fetch = require('node-fetch');
const md5 = require('md5');
const poll = require("easy-polling");
const axios = require("axios")
const express = require('express')
const cors = require('cors')

const corsOptions = {
  origin: '*',
  optionsSuccessStatus: 200 // some legacy browsers (IE11, various SmartTVs) choke on 204
}

const app = express()
app.use(cors())
const port = process.env.PORT || 3000;

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
        try {
                const domainResponse = await fetch("https://privatix-temp-mail-v1.p.rapidapi.com/request/domains/", requestOptions)
                const domains = await domainResponse.json()

                if (domains.length <= 0) {
                        console.error("No domains available from rapid api")
                }

                // handle failure
                const domain = domains[Math.floor(Math.random() * domains.length)];
                const name = Math.random().toString(36).substr(2, 5);
                email = name + domain
        } catch (error) {
                console.error("failed creating temporary email address: ", error)
        }

        console.log("Registering: ", email)
        await registerNewUser(email)

        // introduce polling here
        const emailMd5 = md5(email);
        try {
                const fnAsyncTask = async () => {
                        console.log("$")
                        return await axios.get("https://privatix-temp-mail-v1.p.rapidapi.com/request/mail/id/" + emailMd5 + "/", requestOptions);
                }
                const fnValidate = (result) => {
                        return result.data.length > 0;
                };
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
                console.error("Unable to confirm  " + email + ": ", error)
        }

        const loginTicket = await loginUser(email)
        console.log("ticket is:", loginTicket)
        const serviceTicketUrl = await redeemLoginTicket(loginTicket)
        console.log("service ticket url is:", serviceTicketUrl)
        const authCookies = await redeemServiceTicket(serviceTicketUrl)
        console.log("auth cookies are:", authCookies)

        return authCookies
}

/**
 * register a new user using a temporary email address
 * @param {*} trashEmail 
 */
async function registerNewUser(trashEmail) {
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
                        "body": "{\"email\":\"" + trashEmail + "\",\"password\":\"12345678\"}",
                        "method": "POST",
                        "mode": "cors",
                        "credentials": "include"
                });
        } catch (error) {
                console.error("failed to signup with temporary email address " + trashEmail + ": ", error)
        }
}

/**
 * login and receive a login ticket
 * @param {*} username 
 */
async function loginUser(username) {
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
                        "body": "{\"login\":\"" + username + "\",\"password\":\"12345678\",\"serviceId\":\"bernerzeitung\"}",
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
        }
};

/**
 * Turn the login_ticket into a service ticket url
 * @param {*} login_ticket 
 * @returns 
 */
async function redeemLoginTicket(login_ticket = "") {
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
        });

        if (!resp.headers.get("Location")) {
                console.error("Missing the Location header from the session request")
        }
        return resp.headers.get("Location")
}


/**
 * redeem the service ticket and receive the global
 * authentication cookie "cresid"
 * @param {*} url Url to fetch the cresid cookie from
 * @returns 
 */
async function redeemServiceTicket(url = "") {
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
        });

        if (!resp.headers.get('set-cookie')) {
                console.error("Missing the 'set-cookie' header from the service ticket request")
        }

        return resp.headers.get('set-cookie')
}

app.get('/', async (req, res) => {
        try {
                const responseData = await fetchNewAuthenticationCookie()
                res.contentType('application/json');
                res.json({cookies: responseData})
        } catch {
                res.status(418);
                res.json({error: "I'm a teapot"})
        }
        
})

app.listen(port, () => {
        console.log(`BZ cookie eater listening at http://localhost:${port}`)
})
