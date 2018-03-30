## Classes

<dl>
<dt><a href="#EmailVerifier">EmailVerifier</a></dt>
<dd></dd>
</dl>

## Typedefs

<dl>
<dt><a href="#template">template</a> : <code>function</code></dt>
<dd></dd>
</dl>

<a name="EmailVerifier"></a>

## EmailVerifier
**Kind**: global class  

* [EmailVerifier](#EmailVerifier)
    * [new EmailVerifier(settings)](#new_EmailVerifier_new)
    * [.receive(email, [callbackUrl])](#EmailVerifier+receive) ⇒ <code>string</code>
    * [.verify(accessToken, [settings])](#EmailVerifier+verify)

<a name="new_EmailVerifier_new"></a>

### new EmailVerifier(settings)
Instantiates a new Email Verifier object.
Requires specifying a sending email account by either service (ex: gmail) or server host and port.


| Param | Type | Default | Description |
| --- | --- | --- | --- |
| settings | <code>Object</code> |  | settings |
| settings.credentials | <code>Credentials</code> |  | uPort Credentials object |
| settings.callbackUrl | <code>string</code> |  | endpoint to call when user scans email verification QR |
| settings.user | <code>string</code> |  | sender email address |
| settings.pass | <code>string</code> |  | sender email password |
| [settings.service] | <code>string</code> |  | mail service, takes precedence over mail server params |
| [settings.host] | <code>string</code> |  | mail server host name |
| [settings.port] | <code>number</code> |  | mail server port number |
| [settings.secure] | <code>boolean</code> | <code>false</code> | TLS flag |
| [settings.confirmSubject] | <code>string</code> |  | confirmation email subject |
| [settings.receiveSubject] | <code>string</code> |  | receive attestation email subject |
| [settings.confirmTemplate] | [<code>template</code>](#template) |  | confirmation email template |
| [settings.receiveTemplate] | [<code>template</code>](#template) |  | receive attestation email template |
| [settings.customRequestParams] | <code>Object</code> |  | custom params for credentials.createRequest() |

<a name="EmailVerifier+receive"></a>

### emailVerifier.receive(email, [callbackUrl]) ⇒ <code>string</code>
Generates a selective disclosure request and sends an email containing the request QR.

**Kind**: instance method of [<code>EmailVerifier</code>](#EmailVerifier)  
**Returns**: <code>string</code> - selective disclosure request token  

| Param | Type | Default | Description |
| --- | --- | --- | --- |
| email | <code>string</code> |  | email address to send selective disclosure QR to |
| [callbackUrl] | <code>string</code> | <code>&quot;this.callbackUrl&quot;</code> | endpoint to call when user scans email verification QR |

<a name="EmailVerifier+verify"></a>

### emailVerifier.verify(accessToken, [settings])
Signs a claim attesting ownership of the email address to the uPort identity that
sent the access token.  Sends the attestation via push notification and email.

**Kind**: instance method of [<code>EmailVerifier</code>](#EmailVerifier)  

| Param | Type | Description |
| --- | --- | --- |
| accessToken | <code>string</code> | access token sent by uPort mobile in response to selective disclosure request |
| [settings] | <code>Object</code> | options to send email attestation |
| settings.sendPush | <code>boolean</code> | flag to send email attestation via push notification |
| settings._sendEmail | <code>boolean</code> | flag to send email attestation via email containing QR code |

<a name="template"></a>

## template : <code>function</code>
**Kind**: global typedef  

| Param | Type | Description |
| --- | --- | --- |
| QR | <code>string</code> | QR code to embed in the template |

