import { createWriteStream, unlink } from 'fs'
import { randomBytes } from 'crypto'
import * as url from 'url'

import * as Isemail from 'isemail'
import * as qr from 'qr-image'
import * as nodemailer from 'nodemailer'
import * as jwtDecode from 'jwt-decode'

const DEFAULT_CONFIRM_SUBJECT = 'uPort Email Confirmation'
const DEFAULT_RECEIVE_SUBJECT = 'uPort Email Attestation'
const DEFAULT_TEMPLATE = qr => `<div><img src="${qr}"></img><a href="${qr}">If on mobile, click to open uPort</a></div>`

const throwIfMissing = x => {
    throw new Error(`Missing parameter '${x}'`)
}

class EmailVerifier {

    /**
     * @callback template
     * @param {string} QR - QR code to embed in the template
     */

    /**
     * Instantiates a new Email Verifier object.
     * Requires specifying a sending email account by either service (ex: gmail) or server host and port.
     * 
     * @constructor
     * 
     * @param   {Object}        settings - settings
     * @param   {Credentials}   settings.credentials - uPort Credentials object
     * @param   {string}        settings.callbackUrl - endpoint to call when user scans email verification QR
     * @param   {string}        settings.user - sender email address
     * @param   {string}        settings.pass - sender email password
     * @param   {string}        [settings.service] - mail service, takes precedence over mail server params
     * @param   {string}        [settings.host] - mail server host name
     * @param   {number}        [settings.port] - mail server port number
     * @param   {boolean}       [settings.secure=false] - TLS flag
     * @param   {string}        [settings.confirmSubject] - confirmation email subject
     * @param   {string}        [settings.receiveSubject] - receive attestation email subject
     * @param   {template}      [settings.confirmTemplate] - confirmation email template
     * @param   {template}      [settings.receiveTemplate] - receive attestation email template
     * @param   {Object}        [settings.customRequestParams] - custom params for credentials.createRequest()
     */
    constructor ({
        credentials = throwIfMissing`credentials`,
        callbackUrl = throwIfMissing`callbackUrl`,
        user = throwIfMissing`user`,
        pass = throwIfMissing`pass`,
        service = null,
        host = null,
        port = null,
        secure = false,
        from = '"Admin" <foo@example.com>',
        confirmSubject = DEFAULT_CONFIRM_SUBJECT,
        receiveSubject = DEFAULT_RECEIVE_SUBJECT,
        confirmTemplate = DEFAULT_TEMPLATE,
        receiveTemplate = DEFAULT_TEMPLATE,
        customRequestParams = {},
    } = {}) {
        this.credentials = credentials
        this.callbackUrl = callbackUrl
        const transportOptions = {auth: {user, pass}}
        const server = !!host && !!port
        if (!!service) {
            transportOptions.service = service
        } else if (!!host && !!port) {
            transportOptions.host = host 
            transportOptions.port = port
            transportOptions.secure = secure
        } else {
            throw new Error('Missing email service or server params')
        }
        this.transporter = nodemailer.createTransport({
            service: 'Gmail',
            auth: {
                user,
                pass,
            },
        })
        this.from = from
        this.confirmSubject = confirmSubject
        this.receiveSubject = receiveSubject
        this.confirmTemplate = confirmTemplate
        this.receiveTemplate = receiveTemplate
        this.customRequestParams = customRequestParams
    }

    // TODO(mike.xu): promisify the QR image and email stuff
    // TODO(mike.xu): handle errors that can occur after creating request token
    /**
     * Generates a selective disclosure request and sends an email containing the request QR.
     * 
     * @param {string} email - email address to send selective disclosure QR to
     * @param {string} [callbackUrl=this.callbackUrl] - endpoint to call when user scans email verification QR
     * @return {string} selective disclosure request token
     */
    receive(email = throwIfMissing`email`, callbackUrl = this.callbackUrl) {
        if (!Isemail.validate(email)) throw new Error('invalid email format')

        // add email as callbackUrl param
        const callbackUrlWithEmail = `${callbackUrl}?email=${email}`

        // create selective disclosure JWT
        return this.credentials.createRequest({
            ...this.customRequestParams,
            callbackUrl: callbackUrlWithEmail,
            notifications: true,
        }).then(requestToken => {
            // create uPort request URL from JWT
            const requestUri = `me.uport:me?requestToken=${requestToken}`

            // NOTE(mike.xu): how to calculate the minimum random bytes needed as a function of max images written on fs at once?
            const filename = `QR-${randomBytes(8).toString('hex')}.png`
            // create QR from request URL
            const requestQrData = qr.image(requestUri, {type: 'png'})
            requestQrData
                .pipe(createWriteStream(filename))
                .on('finish', () => {
                    // place QR in email template
                    const emailHtml = this.confirmTemplate(`cid:${filename}`)
                    // send email
                    const emailOptions = {
                        from: this.from,
                        to: email,
                        subject: this.confirmSubject,
                        html: emailHtml,
                        attachments: [{
                            filename: filename,
                            path: `./${filename}`,
                            cid: filename,
                        }],
                    }
                    this.transporter.sendMail(emailOptions, (error, info) => {
                        if (error) return console.log(error)
                        unlink(filename, error => {
                            if (error) console.log('unlink error', error)
                        })
                    })
                })
            return requestToken
        })
    }

    createImage(requestUri) {
        const filename = `QR-${randomBytes(8).toString('hex')}.png` 
        const requestQrData = qr.image(requestUri, {type: 'png'})
        return new Promise((resolve, reject) => {
            requestQrData.pipe(createWriteStream(filename))
            .on('finish', () => {
                return resolve(filename)
            })
            // TODO(mike.xu): reject stream errors
        })
    }

    sendEmail(email, filename, type) {
        const emailOptions = {
            from: this.from,
            to: email,
            subject: this[`${type}Subject`],
            html: this[`${type}Template`](`cid:${filename}`),
            attachments: [{
                filename,
                path: `./${filename}`,
                cid: filename,
            }],
        }
        return new Promise((resolve, reject) => {
            this.transporter.sendMail(emailOptions, (error, info) => {
                if (error) return reject(error)
                return resolve(info)
            })
        })
    }

    deleteImage(filename) {
        return new Promise((resolve, reject) => {
            unlink(filename, error => {
                if (error) return reject(error)
                return resolve(true)
            })
        })
    }

    async receivePromise(
        email = throwIfMissing`email`,
        callbackUrl = this.callbackUrl
    ) {
        if (!Isemail.validate(email)) throw new Error('invalid email format')
        const callbackUrlWithEmail = `${callbackUrl}?email=${email}`
        // NOTE(mike.xu): credentials.createRequest takes param called `callbackUrl`, but sets it to `callback` attribute in token
        const requestToken = await this.credentials.createRequest({
            callbackUrl: callbackUrlWithEmail,
            notifications: true,
            ...this.customRequestParams,
        })
        const requestUri = `me.uport:me?requestToken=${requestToken}`
        const filename = await createImage(requestUri)
        await sendEmail(email, filename, 'confirm')
        await deleteImage(filename)
        return filename
    }

    /**
     * Signs a claim attesting ownership of the email address to the uPort identity that
     * sent the access token.  Sends the attestation via push notification and email.
     * 
     * @param {string} accessToken - access token sent by uPort mobile in response to selective disclosure request
     * @param {Object} [settings] - options to send email attestation
     * @param {boolean} settings.sendPush - flag to send email attestation via push notification
     * @param {boolean} settings.sendEmail - flag to send email attestation via email containing QR code
     */
    verify(accessToken, settings = {sendPush: true, sendEmail: true}) {
        const sendPush = !(settings.sendPush === false)
        const sendEmail = !(settings.sendEmail === false)

        // TODO(mike.xu): figure out how to import this properly and not have to call default
        const requestToken = jwtDecode.default(accessToken).req
        /**
         * NOTE(mike.xu): if email is passed through callback url, take it as a param passed from endpoint
         * would it be possible for someone to modify the email in the callback url?
         * if email is passed as a property in the request token, need to parse it out
         */
        const callbackUrlWithEmail = jwtDecode.default(requestToken).callback
        const email = url.parse(callbackUrlWithEmail, true).query.email

        let identity = null
        let attestation = null
        let attestationUri = null

        return this.credentials.receive(accessToken)
        .then(result => {
            identity = result
            return this.credentials.attest({
                sub: identity.address,
                claim: {email}
            })
        })
        .then(result => {
            attestation = result
            attestationUri = `me.uport:add?attestations=${attestation}`
            if (sendPush) {
                return this.credentials.push(
                    identity.pushToken,
                    {url: attestationUri}
                )
            } else {
                return new Promise((resolve, reject) => (resolve(attestation)))
            }
        })
        .then(result => {
            if (sendEmail) {
                const filename = `QR-${randomBytes(8).toString('hex')}.png`
                const attestationQrData = qr.image(attestationUri, {type: 'png'})
                attestationQrData
                    .pipe(createWriteStream(filename))
                    .on('finish', () => {
                        const emailHtml = this.receiveTemplate(`cid:${filename}`)
                        const emailOptions = {
                            from: this.from,
                            to: email,
                            subject: this.receiveSubject,
                            html: emailHtml,
                            attachments: [{
                                filename: filename,
                                path: `./${filename}`,
                                cid: filename,
                            }],
                        }
                        this.transporter.sendMail(emailOptions, (error, info) => {
                            if (error) return console.log(error)
                            unlink(filename, error => {
                                if (error) console.log('unlink error', error)
                            })
                        })
                    })
            }
            return {
                ...identity,
                attestation,
                email: email,
                accessToken: accessToken
            }
        })
    }

    async verifyPromise(
        accessToken,
        settings = {sendPush: true, sendEmail: true}
    ) {
        const sendPush = !(settings.sendPush === false)
        const sendEmail = !(settings.sendEmail === false)
        const requestToken = jwtDecode.default(accessToken).req
        const callbackUrlWithEmail = jwtDecode.default(requestToken).callback
        const email = url.parse(callbackUrlWithEmail, true).query.email
        const identity = await this.credentials.receive(accessToken)
        const attestation = await this.credentials.attest({
            sub: identity.address,
            claim: {email}
        })
        const attestationUri = `me.uport:add?attestations=${attestation}`
        if (sendPush) {
            await this.credentials.push(
                identity.pushToken,
                {url: attestationUri}
            )
        }
        if (sendEmail) {
            const filename = await this.createImage(attestationUri)
            await this.sendEmail(email, filename, 'receive')
            await this.deleteImage(filename)
        }
        return {
            ...identity,
            attestation,
            email,
            accessToken
        }
    }
}

export default EmailVerifier