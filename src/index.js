class EmailVerifier {

    /**
     * @callback template
     * @param {string} QR - QR code to embed in the template
     */

    /**
     * Instantiates a new Email Verifier object.
     * 
     * @constructor
     * 
     * @param   {Object}        settings - settings
     * @param   {string}        settings.user - sender email address
     * @param   {string}        settings.pass - sender email password
     * @param   {string}        settings.host - mail server host name
     * @param   {number}        settings.port - mail server port number
     * @param   {boolean}       settings.secure - TLS flag
     * @param   {string}        settings.confirmSubject - confirmation email subject
     * @param   {string}        settings.receiveSubject - receive attestation email subject
     * @param   {template}      settings.confirmTemplate - confirmation email template
     * @param   {template}      settings.receiveTemplate - receive attestation email template
     * @param   {Object}        settings.customRequestParams - custom params for credentials.createRequest()
     * @param   {Credentials}   settings.credentials - uPort Credentials object
     */
    constructor (settings) {
        this.settings = settings
    }

    /**
     * Generates a selective disclosure request and sends an email containing the request QR.
     * 
     * @param {string} email - email address to send selective disclosure QR to
     * @return {string} selective disclosure request token
     */
    receiveEmail (email) {
        return 'requestToken'
    }

    /**
     * Parses out the original request token from a response access token.
     * NOTE: this should probably be exported independently outside the class
     * 
     * @param {string} accessToken - token from uPort mobile app in response to the request token
     * @return {string} selective disclosure request token
     */
    getRequestToken (accessToken) {
        return 'requestToken'
    }

    /**
     * Signs a claim attesting ownership of the email address to the uPort identity that
     * sent the access token.  Sends the attestation via push notification and email.
     * 
     * @param {string} accessToken 
     * @param {string} email 
     */
    verify (accessToken, email) {
        return { email }
    }
}

export default EmailVerifier