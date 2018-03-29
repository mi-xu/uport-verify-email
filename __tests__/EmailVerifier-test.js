import EmailVerifier from '../src'

jest.mock('isemail', () => ({
    // NOTE(mike.xu): this string should match INVALID_EMAIL
    validate: jest.fn(email => email !== 'invalid email@me')
}))
import * as Isemail from 'isemail'

jest.mock('qr-image', () => ({
    image: jest.fn(() => ({
        pipe: () => ({
            on: (event, cb) => {
                cb()
            },
        })
    })),
}))
import * as qr from 'qr-image' 

jest.mock('fs', () => ({
    createWriteStream: jest.fn(),
    unlink: jest.fn((filename, cb) => { cb(null) })
}))
import { createWriteStream, unlink } from 'fs'

jest.mock('crypto', () => ({
    randomBytes: jest.fn(() => (Buffer.from([0x00])))
}))

jest.mock('nodemailer', () => ({
    createTransport: () => ({
        sendMail: jest.fn((emailOptions, cb) => { cb(null, {}) }),
    }),
}))
import * as nodemailer from 'nodemailer'

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
// TODO(mike.xu): set this to be an actual example JWT
const REQUEST_TOKEN = 'JWT'
const CREDENTIALS = {
    createRequest: jest.fn(args => (
        new Promise((resolve, reject) => { resolve(REQUEST_TOKEN) })
    ))
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

describe('receive', () => {
    beforeEach(() => {
        CREDENTIALS.createRequest.mockClear()
        Isemail.validate.mockClear()
        qr.image.mockClear()
        createWriteStream.mockClear()
        unlink.mockClear()
    })

    it('should should attempt to validate the email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)
        verifier.receive(EMAIL)

        expect(Isemail.validate.mock.calls.length).toBe(1)
    })

    it('should throw an error when called without an email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect(() => verifier.receive()).toThrow(/email/)
    })

    it('should throw an error when called with an invalid email address', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect(() => verifier.receive(INVALID_EMAIL)).toThrow(/invalid email format/)
    })

    it('should call createRequest with notifications and callback containing the email', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)
        const createRequestCalls = verifier.credentials.createRequest.mock.calls

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            expect(createRequestCalls.length).toBe(1)
            expect(createRequestCalls[0][0]).toEqual({
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
        const createRequestCalls = verifier.credentials.createRequest.mock.calls

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            expect(createRequestCalls.length).toBe(1)
            expect(createRequestCalls[0][0]).toEqual({
                callbackUrl: CALLBACK_WITH_EMAIL,
                notifications: true,
                ...CUSTOM_REQUEST_PARAMS,
            })
        })
    })

    it('should call qr.image with a uPort url containing the request token', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(1)
        return verifier.receive(EMAIL).then(result => {
            expect(qr.image.mock.calls.length).toBe(1)
        })
    })

    it('should save the QR image to a png file', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(1)
        return verifier.receive(EMAIL).then(result => {
            expect(createWriteStream.mock.calls.length).toBe(1)
        })
    })

    it('should send an email with the QR image attached', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            const sendMailCalls = verifier.transporter.sendMail.mock.calls
            expect(sendMailCalls.length).toBe(1)
            expect(sendMailCalls[0][0].attachments).toContainEqual(
                expect.objectContaining({ filename })
            )
        })
    })

    it('should delete the QR png after sending the email', () => {
        const verifier = new EmailVerifier(REQUIRED_SETTINGS)

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            expect(unlink.mock.calls.length).toBe(1)
            expect(unlink.mock.calls[0][0]).toBe(filename)
        })
    })
})