import * as crypto from 'crypto';

export type RequestValidator = (req: Request) => Promise<Boolean>;

export function getAlchemyValidator(signingKey: string): RequestValidator {
  return async (req: Request) => {
    const header = req.headers.get('X-Alchemy-Signature');
    if (!header) return false;

    const theirSignature = Buffer.from(header);

    const hmac = crypto.createHmac('sha256', signingKey);
    const body = await req.clone().text();
    hmac.update(body, 'utf8');
    const ourSignature = Buffer.from(hmac.digest('hex'));

    if (theirSignature.length !== ourSignature.length) return false;

    return crypto.timingSafeEqual(theirSignature, ourSignature);
  };
}
