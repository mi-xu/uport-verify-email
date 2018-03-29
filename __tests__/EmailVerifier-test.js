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
const SERVICE = 'gmail'
const HOST = 'smtp.uport.me'
const PORT = 465
const USER = 'username'
const PASS = 'password'
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
const MAIL_AUTH_PARAMS = {
    user: USER,
    pass: PASS,
}
const MAIL_SERVER_PARAMS = {
    host: HOST,
    port: PORT,
}
const VALID_PARAMS = {
    credentials: CREDENTIALS,
    callbackUrl: CALLBACK_URL,
    ...MAIL_AUTH_PARAMS,
    service: SERVICE,
}

describe('constructor', () => {
    it('should throw an error when initialized without uPort credentials', () => {
        expect(() => new EmailVerifier({
            callbackUrl: CALLBACK_URL,
            ...MAIL_AUTH_PARAMS,
            service: SERVICE,
        }).toThrow(/credentials/))
    })

    it('should throw an error when initialized without callbackUrl', () => {
        expect(() => new EmailVerifier({
            credentials: CREDENTIALS,
            ...MAIL_AUTH_PARAMS,
            service: SERVICE,
        })).toThrow(/callbackUrl/)
    })

    it('should throw an error when initialized without an email user', () => {
        expect(() => new EmailVerifier({
            credentials: CREDENTIALS,
            callbackUrl: CALLBACK_URL,
            pass: PASS,
            service: SERVICE,
        })).toThrow(/user/)
    })

    it('should throw an error when initialized without an email password', () => {
        expect(() => new EmailVerifier({
            credentials: CREDENTIALS,
            callbackUrl: CALLBACK_URL,
            user: USER,
            service: SERVICE,
        })).toThrow(/pass/)
    })

    it('should throw an error when initialized without email service or server params', () => {
        expect(() => new EmailVerifier({
            credentials: CREDENTIALS,
            callbackUrl: CALLBACK_URL,
            ...MAIL_AUTH_PARAMS,
        })).toThrow(/email/)
    })

    it('should return an EmailVerifier when initialized with mail service params', () => {
        expect(new EmailVerifier({
            credentials: CREDENTIALS,
            callbackUrl: CALLBACK_URL,
            ...MAIL_AUTH_PARAMS,
            service: SERVICE,
        })).toEqual(expect.objectContaining({
            receive: expect.any(Function),
            verify: expect.any(Function),
        }))
    })

    it('should return an EmailVerifier when initialized with mail server params', () => {
        expect(new EmailVerifier({
            credentials: CREDENTIALS,
            callbackUrl: CALLBACK_URL,
            ...MAIL_AUTH_PARAMS,
            ...MAIL_SERVER_PARAMS,
        })).toEqual(expect.objectContaining({
            receive: expect.any(Function),
            verify: expect.any(Function),
        }))
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
        const verifier = new EmailVerifier(VALID_PARAMS)
        verifier.receive(EMAIL)

        expect(Isemail.validate.mock.calls.length).toBe(1)
    })

    it('should throw an error when called without an email address', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect(() => verifier.receive()).toThrow(/email/)
    })

    it('should throw an error when called with an invalid email address', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect(() => verifier.receive(INVALID_EMAIL)).toThrow(/invalid email format/)
    })

    it('should call createRequest with notifications and callback containing the email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)
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
            ...VALID_PARAMS,
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
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(1)
        return verifier.receive(EMAIL).then(result => {
            expect(qr.image.mock.calls.length).toBe(1)
        })
    })

    it('should save the QR image to a png file', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(1)
        return verifier.receive(EMAIL).then(result => {
            expect(createWriteStream.mock.calls.length).toBe(1)
        })
    })

    it('should send an email with the QR image attached', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

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
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            expect(unlink.mock.calls.length).toBe(1)
            expect(unlink.mock.calls[0][0]).toBe(filename)
        })
    })
})