import * as crypto from 'crypto';

export function generateHashDigest(content: string, maxLength?: number): string {
    const hash = crypto.createHash('md5');
    hash.update(content);

    return maxLength ? hash.digest('hex').substr(0, maxLength) : hash.digest('hex');
}
