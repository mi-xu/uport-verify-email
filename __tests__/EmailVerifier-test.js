import EmailVerifier from '../src'

const CALLBACK_URL = 'https://api.uport.me/verify'
const USER = 'username'
const PASS = 'password'
const HOST = 'smtp.uport.me'
const PORT = 465
const CREDENTIALS = {}

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
        expect(() => new EmailVerifier({
            callbackUrl: CALLBACK_URL,
            user: USER,
            pass: PASS,
            host: HOST,
            port: PORT,
        })).toThrow(/credentials/)
    })

    it('should return an object when initialized with the required settings', () => {
        const verifier = new EmailVerifier({
            callbackUrl: CALLBACK_URL,
            user: USER,
            pass: PASS,
            host: HOST,
            port: PORT,
            credentials: CREDENTIALS,
        })

        expect(verifier).not.toBeNull()
    })
})