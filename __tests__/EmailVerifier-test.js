import EmailVerifier from '../src'
/**
 * TODO(mike.xu): clean up tests and add tests for uncovered branches using mock return values
 * https://facebook.github.io/jest/docs/en/mock-functions.html#mock-return-values 
 */

jest.mock('fs', () => ({
    createWriteStream: jest.fn(),
    unlink: jest.fn((filename, cb) => { cb(null) })
}))
import { createWriteStream, unlink } from 'fs'

jest.mock('crypto', () => ({
    randomBytes: jest.fn(() => (Buffer.from([0x00])))
}))
import { randomBytes } from 'crypto'

jest.mock('isemail', () => ({
    // NOTE(mike.xu): this string must match INVALID_EMAIL
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

jest.mock('nodemailer', () => ({
    createTransport: () => ({
        sendMail: jest.fn((emailOptions, cb) => { cb(null, {}) }),
    }),
}))
import * as nodemailer from 'nodemailer'

jest.mock('jwt-decode', () => (jest.fn()))
import * as jwtDecode from 'jwt-decode'

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
const ADDRESS = 'mnid'
// TODO(mike.xu): set tokens to be an actual example JWT?
const REQUEST_TOKEN = 'request JWT'
const ACCESS_TOKEN = 'access JWT'
const PUSH_TOKEN = 'push JWT'
const ATTESTATION = 'attestation JWT'
// eyJ0eXAiOiJKV1QiLCJhbGciOiJFUzI1NksifQ.eyJpc3MiOiIyb3JEdVBWNDd0R0o5WHE0UnlHb1l2
// b1E3N1pyVTdGREVIVCIsImlhdCI6MTUyMjM2NDgxMiwicGVybWlzc2lvbnMiOlsibm90aWZpY2F0aW9
// ucyJdLCJjYWxsYmFjayI6Imh0dHA6Ly8xOTIuMTY4LjEuNDozMDAwL2FwaS9kaWdpdGFsVXNlcnMvdm
// VyaWZ5RW1haWw_ZW1haWw9bWlrZS54dUBjb25zZW5zeXMubmV0IiwiZXhwIjoxNTIyMzY1NDEyLCJ0e
// XBlIjoic2hhcmVSZXEifQ.zCnIaFvMoyu6BkGyo5rkOAuKeOfEU7OYDG7TIzLDNQ9ZDrOm3_mWdtqP3
// HaJpNSGdIjEIPXOlVxae_Rlm6JRoA
const CREDENTIALS = {
    createRequest: jest.fn(args => (
        new Promise((resolve, reject) => { resolve(REQUEST_TOKEN) })
    )),
    receive: jest.fn(),
    attest: jest.fn(),
    push: jest.fn(),
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

    it('should create a credential request with notifications and callback containing the email', () => {
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

    it('should create a credential request with custom request params', () => {
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

    it('should create a QR for a uPort url containing the request token', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(2)
        return verifier.receive(EMAIL).then(result => {
            const imageCalls = qr.image.mock.calls
            expect(imageCalls.length).toBe(1)
            expect(imageCalls[0][0]).toEqual(expect.stringContaining(REQUEST_TOKEN))
        })
    })

    it('should save the request QR image to a file', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(1)
        return verifier.receive(EMAIL).then(result => {
            expect(createWriteStream.mock.calls.length).toBe(1)
        })
    })

    it('should send an email with the request QR image attached', () => {
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

    it('should delete the request QR image after sending the email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(3)
        return verifier.receive(EMAIL).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            const unlinkCalls = unlink.mock.calls
            expect(verifier.transporter.sendMail.mock.calls.length).toBe(1)
            // TODO(mike.xu): figure out how to assert order of mocked function calls
            // NOTE(mike.xu): mock.timestamps only has ms precision, not enough to tell
            expect(unlinkCalls.length).toBe(1)
            expect(unlinkCalls[0][0]).toBe(filename)
        })
    })
})

describe('verify', () => {
    beforeAll(() => {
        CREDENTIALS.receive.mockReturnValue(new Promise((resolve, reject) => (
            resolve({
                address: ADDRESS,
                pushToken: PUSH_TOKEN,
            })
        )))
        CREDENTIALS.attest.mockReturnValue(new Promise((resolve, reject) => (
            resolve(ATTESTATION)
        )))
        CREDENTIALS.push.mockReturnValue(new Promise((resolve, reject) => (
            resolve()
        )))
    })

    beforeEach(() => {
        CREDENTIALS.receive.mockClear()
        CREDENTIALS.attest.mockClear()
        CREDENTIALS.push.mockClear()
        jwtDecode.default.mockClear()
        jwtDecode.default
            .mockReturnValueOnce({req: REQUEST_TOKEN})
            .mockReturnValueOnce({callback: CALLBACK_WITH_EMAIL})
        qr.image.mockClear()
        createWriteStream.mockClear()
        unlink.mockClear()
    })

    it('should create and sign an attestation claiming the email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(2)
        return verifier.verify(ACCESS_TOKEN).then(result => {
            const attestCalls = CREDENTIALS.attest.mock.calls
            expect(attestCalls.length).toBe(1)
            expect(attestCalls[0][0]).toEqual({
                sub: ADDRESS,
                claim: { email: EMAIL },
            })
        })
    })

    it('should send a push notification containing the attestation', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(3)
        return verifier.verify(ACCESS_TOKEN).then(result => {
            const pushCalls = CREDENTIALS.push.mock.calls
            expect(pushCalls.length).toBe(1)
            expect(pushCalls[0][0]).toBe(PUSH_TOKEN)
            expect(pushCalls[0][1]).toEqual(expect.objectContaining({
                url: expect.stringContaining(ATTESTATION)
            }))
        })
    })

    it('should optionally skip sending a push notification', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(1)
        return verifier.verify(ACCESS_TOKEN, {sendPush: false}).then(result => {
            expect(CREDENTIALS.push.mock.calls.length).toBe(0)
        })
    })

    it('should create a QR for a uPort url containing the attestation', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(2)
        return verifier.verify(ACCESS_TOKEN).then(result => {
            const imageCalls = qr.image.mock.calls
            expect(imageCalls.length).toBe(1)
            expect(imageCalls[0][0]).toEqual(expect.stringContaining(ATTESTATION))
        })
    })

    it('should save the attestation QR image to a file', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(1)
        return verifier.verify(ACCESS_TOKEN).then(result => {
            expect(createWriteStream.mock.calls.length).toBe(1)
        })
    })

    it('should send an email with the attestation QR image attached', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(2)
        return verifier.verify(ACCESS_TOKEN).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            const sendMailCalls = verifier.transporter.sendMail.mock.calls
            expect(sendMailCalls.length).toBe(1)
            expect(sendMailCalls[0][0].attachments).toContainEqual(
                expect.objectContaining({ filename })
            )
        })
    })

    it('should delete the attestation QR image after sending the email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(3)
        return verifier.verify(EMAIL).then(result => {
            const filename = createWriteStream.mock.calls[0][0]
            const unlinkCalls = unlink.mock.calls
            expect(verifier.transporter.sendMail.mock.calls.length).toBe(1)
            expect(unlinkCalls.length).toBe(1)
            expect(unlinkCalls[0][0]).toBe(filename)
        })
    })

    it('should optionally skip sending an email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(4)
        return verifier.verify(EMAIL, {sendEmail: false}).then(result => {
            expect(qr.image.mock.calls.length).toBe(0)
            expect(createWriteStream.mock.calls.length).toBe(0)
            expect(verifier.transporter.sendMail.mock.calls.length).toBe(0)
            expect(unlink.mock.calls.length).toBe(0)
        })
    })

    it('should optionally skip sending a push notification and email', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        expect.assertions(5)
        return verifier.verify(EMAIL, {sendPush: false, sendEmail: false}).then(result => {
            expect(CREDENTIALS.push.mock.calls.length).toBe(0)
            expect(qr.image.mock.calls.length).toBe(0)
            expect(createWriteStream.mock.calls.length).toBe(0)
            expect(verifier.transporter.sendMail.mock.calls.length).toBe(0)
            expect(unlink.mock.calls.length).toBe(0)
        })
    })

    it('should return an identity object describing the recipient', () => {
        const verifier = new EmailVerifier(VALID_PARAMS)

        return verifier.verify(EMAIL).then(result => {
            expect(result).toEqual(expect.objectContaining({
                address: ADDRESS,
                attestation: ATTESTATION,
                email: EMAIL,
            }))
        })
    })
})