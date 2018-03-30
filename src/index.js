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

    /**
     * Generates a selective disclosure request and sends an email containing the request QR.
     * 
     * @param {string} email - email address to send selective disclosure QR to
     * @param {string} [callbackUrl=this.callbackUrl] - endpoint to call when user scans email verification QR
     * @return {string} selective disclosure request token
     */
    async receive(
        email = throwIfMissing`email`,
        callbackUrl = this.callbackUrl
    ) {
        if (!Isemail.validate(email)) return Promise.reject('invalid email format')
        const callbackUrlWithEmail = `${callbackUrl}?email=${email}`
        // NOTE(mike.xu): credentials.createRequest takes param called `callbackUrl`, but sets it to `callback` attribute in token
        const requestToken = await this.credentials.createRequest({
            callbackUrl: callbackUrlWithEmail,
            notifications: true,
            ...this.customRequestParams,
        })
        const requestUri = `me.uport:me?requestToken=${requestToken}`
        return await this._sendEmailWithQR(email, requestUri, 'confirm')
    }

    /**
     * Signs a claim attesting ownership of the email address to the uPort identity that
     * sent the access token.  Sends the attestation via push notification and email.
     * 
     * @param {string} accessToken - access token sent by uPort mobile in response to selective disclosure request
     * @param {Object} [settings] - options to send email attestation
     * @param {boolean} settings.sendPush - flag to send email attestation via push notification
     * @param {boolean} settings._sendEmail - flag to send email attestation via email containing QR code
     */
    async verify(
        accessToken,
        settings = {sendPush: true, sendEmail: true}
    ) {
        // TODO(mike.xu): figure out how to import this properly and not have to call default
        const requestToken = jwtDecode.default(accessToken).req
        const callbackUrlWithEmail = jwtDecode.default(requestToken).callback
        /**
         * NOTE(mike.xu): is it necessary to parse the email out of the token or should we
         * trust the request param and pass it in to this function?
         */
        const email = url.parse(callbackUrlWithEmail, true).query.email
        const identity = await this.credentials.receive(accessToken)
        const attestation = await this.credentials.attest({
            sub: identity.address,
            claim: {email}
        })
        const attestationUri = `me.uport:add?attestations=${attestation}`
        if (!(settings.sendPush === false)) {
            try {
                await this.credentials.push(
                    identity.pushToken,
                    {url: attestationUri}
                )
            } catch (error) {
                console.error('Error pushing attestation:', error)
            }
        }
        if (!(settings.sendEmail === false)) {
            try {
                await this._sendEmailWithQR(email, attestationUri, 'receive')
            } catch (error) {
                console.error('Error sending attestation email:', error)
            }
        }
        return {
            ...identity,
            attestation,
            email,
            accessToken
        }
    }

    _createImage(requestUri) {
        // NOTE(mike.xu): how to calculate the minimum random bytes needed as a function of max images written on fs at once?
        const filename = `QR-${randomBytes(8).toString('hex')}.png` 
        const requestQrData = qr.image(requestUri, {type: 'png'})
        return new Promise((resolve, reject) => {
            requestQrData.pipe(createWriteStream(filename))
            .on('finish', () => {
                return resolve(filename)
            })
        })
    }

    _sendEmail(email, filename, type) {
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

    _deleteImage(filename) {
        return new Promise((resolve, reject) => {
            unlink(filename, error => {
                if (error) return reject(error)
                return resolve(true)
            })
        })
    }

    async _sendEmailWithQR(email, qrData, messageType) {
        const filename = await this._createImage(qrData)
        const emailInfo = await this._sendEmail(email, filename, messageType)
        await this._deleteImage(filename)
        return emailInfo
    }
}

export default EmailVerifier