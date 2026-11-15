import { ValidationOptions, registerDecorator } from 'class-validator';
import type { ZodSchema } from 'zod';
import {
  otpCodeSchema,
  phoneNumberSchema,
  pinCodeSchema,
} from '@pitzaa/shared';

function createZodValidator(name: string, schema: ZodSchema, message: string) {
  return (validationOptions?: ValidationOptions) =>
    function (object: object, propertyName: string) {
      registerDecorator({
        name,
        target: object.constructor,
        propertyName,
        options: validationOptions,
        validator: {
          validate(value: unknown) {
            return typeof value === 'string' && schema.safeParse(value).success;
          },
          defaultMessage() {
            return message;
          },
        },
      });
    };
}

/** Numéro international de la zone CEMAC, ex: +237612345678 (voir @pitzaa/shared). */
export const IsCemacPhone = createZodValidator(
  'isCemacPhone',
  phoneNumberSchema,
  'Le numéro doit être un numéro international valide de la zone CEMAC (ex: +237612345678)',
);

/** Code OTP à 6 chiffres. */
export const IsOtpCode = createZodValidator(
  'isOtpCode',
  otpCodeSchema,
  'Le code OTP doit comporter 6 chiffres',
);

/** PIN Pitzaa à 4-6 chiffres (jamais le code PIN mobile money). */
export const IsPitzaaPin = createZodValidator(
  'isPitzaaPin',
  pinCodeSchema,
  'Le PIN doit comporter entre 4 et 6 chiffres',
);
