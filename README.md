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
    auth: {
        user: process.env.EMAIL_USER,
        pass: process.env.EMAIL_PASS,
    },
    port: 465,
    host: 'smtp.uport.me',
    secure: true, // use TLS
    confirmationSubject: 'uPort Identity ',
    confirmationTemplate: qr => `<html>...${qr}...</html>`,
    attestationSubject: 'uPort Email Attestation',
    attestationTemplate: qr => `<html>...${qr}...</html>`,
    customRequestParams: {},
    credentials: uPortApp,
})
```

## Receiving an email address and sending selective disclosure QR
```js
// endpoint reads email from request params
const email = params.email

// send an email to user containing the request QR and return the token
const requestToken = verifier.receiveEmail(email)

// persist the email indexed by request token
db.put(requestToken, email)
```

## User scans QR in email and posts API callback
```js
// endpoint reads access token from POST data
const accessToken = data.access_token

// parse the original request token from the access token
const req = verifier.getRequestToken(accessToken)

// look up email for given request token
const email = db.get(req)

// sign an attestation claiming control of the email
// push the attestation and send an email with QR to download
const identity = verifier.verify(accessToken, email)

// do something with the email and request identity attributes
db.createUser(identity)
```