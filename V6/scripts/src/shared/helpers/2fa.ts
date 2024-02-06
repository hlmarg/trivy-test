import * as speakeasy from 'speakeasy';

export const generate2FACode = (secret: string): string => {
  const token = speakeasy.totp({
    secret: secret,
    encoding: 'base32',
  });

  return token;
};
