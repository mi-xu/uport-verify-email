import EmailVerifier from '../src'

import * as Isemail from 'isemail'
jest.mock('isemail', () => ({
    // NOTE(mike.xu): how to mock this properly?
    validate: jest.fn(email => email !== 'invalid email@me')
}))

import * as qr from 'qr-image' 
jest.mock('qr-image', () => ({
    imageSync: jest.fn(() => 'base 64 png data')
}))

const CALLBACK_URL = 'https://api.uport.me/verify'
const USER = 'username'
const PASS = 'password'
const HOST = 'smtp.uport.me'
const PORT = 465
const EMAIL = 'user@uport.me'
const INVALID_EMAIL = 'invalid email@me'
const CUSTOM_REQUEST_PARAMS = {
    requested: ['avatar', 'name'],
    verified: ['custom-attestation-title'],
}
const createRequest = jest.fn(args => (
    new Promise((resolve, reject) => {
        resolve('JWT')
    })
))
const CREDENTIALS = {
    createRequest
}

const CALLBACK_WITH_EMAIL = `${CALLBACK_URL}?email=${EMAIL}`
const EMAIL_SETTINGS = {
    callbackUrl: CALLBACK_URL,
    user: USER,
    pass: PASS,
    host: HOST,
    port: PORT,
}
const REQUIRED_SETTINGS = {
    ...EMAIL_SETTINGS,
    credentials: CREDENTIALS,
}

describe('constructor', () => {
    it('should throw an error when initialized without callbackUrl', () => {
        expect(() => new EmailVerifier()).toThrow(/callbackUrl/)
    })

    it('should throw an error when initialized without email configs', () => {
        expect(() => new EmailVerifier({
            callbackUrl: CALLBACK_URL,
        })).toThrow(/user/)
    })

    it('should throw an error when initialized without uPort credentials', () => {
        expect(() => new EmailVerifier(EMAIL_SETTINGS).toThrow(/credentials/))
    })

    it('should return an object when initialized with the required settings', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect(verifier).not.toBeNull()
    })
})

describe('receiveEmail', () => {
    beforeEach(() => {
        createRequest.mockClear()
        Isemail.validate.mockClear()
        qr.imageSync.mockClear()
    })

    it('should should attempt to validate the email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)
        verifier.receiveEmail(EMAIL)

        expect(Isemail.validate.mock.calls.length).toBe(1)
    })

    it('should throw an error when called without an email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect(() => verifier.receiveEmail()).toThrow(/email/)
    })

    it('should throw an error when called with an invalid email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect(() => verifier.receiveEmail(INVALID_EMAIL)).toThrow(/invalid email format/)
    })

    it('should call createRequest with notifications and callback containing the email', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(2)
        return verifier.receiveEmail(EMAIL).then(result => {
            expect(createRequest.mock.calls.length).toBe(1)
            expect(createRequest.mock.calls[0][0]).toEqual({
                callbackUrl: CALLBACK_WITH_EMAIL,
                notifications: true,
            })
        })
    })

    it('should call createRequest with custom request params', () => {
        const verifier = new EmailVerifier({
            ...REQUIRED_SETTINGS,
            customRequestParams: CUSTOM_REQUEST_PARAMS,
        })

        expect.assertions(2)
        return verifier.receiveEmail(EMAIL).then(result => {
            expect(createRequest.mock.calls.length).toBe(1)
            expect(createRequest.mock.calls[0][0]).toEqual({
                callbackUrl: CALLBACK_WITH_EMAIL,
                notifications: true,
                ...CUSTOM_REQUEST_PARAMS,
            })
        })
    })

    it('should call qr.image with a uPort url containing the request token', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(1)
        return verifier.receiveEmail(EMAIL).then(result => {
            expect(qr.imageSync.mock.calls.length).toBe(1)
        })
    })

    it('should create an email containing the selective disclosure request QR', () => {
        expect(true).toBeFalsy()
    })

    it('should call sendMail from the nodemailer transporter with the QR email', () => {
        expect(true).toBeFalsy()
    })

    it('should return the selective disclosure request token', () => {
        expect(true).toBeFalsy()
    })
})