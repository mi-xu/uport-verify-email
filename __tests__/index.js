import { EmailVerifier } from '../src'

describe ('EmailVerifier', () => {
    let verifier = new EmailVerifier({})
    return expect(verifier).not.toBeNull()
})