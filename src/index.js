import * as Isemail from 'isemail'
import * as qr from 'qr-image'
import * as nodemailer from 'nodemailer'
import { createWriteStream, unlink } from 'fs'
import { randomBytes } from 'crypto'

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
    receive (email = throwIfMissing`email`, callbackUrl = this.callbackUrl) {
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
            // create QR from request URL
            const requestQrData = qr.image(requestUri, { type: 'png' })
            // NOTE(mike.xu): how to calculate the minimum random bytes needed as a function of max images written on fs at once?
            const filename = `QR-${randomBytes(8).toString('hex')}.png`;
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

    /**
     * Signs a claim attesting ownership of the email address to the uPort identity that
     * sent the access token.  Sends the attestation via push notification and email.
     * 
     * @param {string} accessToken - access token sent by uPort mobile in response to selective disclosure request
     * @param {Object} [settings] - options to send email attestation
     * @param {boolean} settings.sendPush - flag to send email attestation via push notification
     * @param {boolean} settings.sendEmail - flag to send email attestation via email containing QR code
     */
    verify (accessToken, settings = {sendPush: true, sendEmail: true}) {
        return this.credentials.receive(accessToken)
        .then(identity => {
            return {
                address: identity.address,
                pushToken: identity.pushToken,
                accessToken: accessToken
            }
        })
    }
}

export default EmailVerifier