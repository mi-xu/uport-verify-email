import EmailVerifier from '../src'

describe('EmailVerifier', () => {
    it('should initialize with settings', () => {
        const verifier = new EmailVerifier({})
        return expect(verifier).not.toBeNull()
    })
})
