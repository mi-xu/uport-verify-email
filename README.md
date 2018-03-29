# uport-verify-email

## Configuring the verifier
```js
import { Credentials, SimpleSigner } from 'uport'
import EmailVerifier from 'uport-verify-email'

// set up the uport app credentials
const uPortApp = new Credentials({..., signer: new SimpleSigner(...)})

// set up the email account for sending verification QRs
// pass the uport app credentials
const verifier = new EmailVerifier({
    credentials: uPortApp,
    callbackUrl: 'https://api.uport.me/verify',
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
    service: 'gmail',
    // as an alternative to service, can take the transport params
    // host: string (ex: 'smtp.uport.me')
    // port: number (ex: 465)
    // secure: boolean (ex: true for TLS)
    confirmationSubject: 'uPort Identity ',
    confirmationTemplate: qr => `<html>...${qr}...</html>`,
    attestationSubject: 'uPort Email Attestation',
    attestationTemplate: qr => `<html>...${qr}...</html>`,
    customRequestParams: {},
})
```

## Receiving an email address and sending selective disclosure QR
```js
// endpoint reads email from request params
const email = params.email

// send an email to user containing the request QR and return the token
const requestToken = verifier.receive(email)
```

## Handling callback after user scans QR from their email
```js
// endpoint reads access token from POST data
const accessToken = data.access_token

// sign an attestation claiming control of the email
// by default, push the attestation and send an email with QR to download
const identity = verifier.verify(accessToken)

// do something with the email and request identity attributes
db.createUser(identity)
```