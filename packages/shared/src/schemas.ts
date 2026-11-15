import { z } from "zod";
import { CEMAC_PHONE_PREFIXES } from "./constants";

/** Numéro de téléphone international, préfixe CEMAC accepté (ex: +237612345678). */
export const phoneNumberSchema = z
  .string()
  .regex(/^\+\d{8,15}$/, "Le numéro doit être au format international, ex: +237612345678")
  .refine(
    (value) => CEMAC_PHONE_PREFIXES.some((prefix) => value.startsWith(prefix)),
    "Indicatif téléphonique non pris en charge dans la zone CEMAC",
  );

export const otpCodeSchema = z.string().regex(/^\d{6}$/, "Le code OTP doit comporter 6 chiffres");

export const pinCodeSchema = z.string().regex(/^\d{4,6}$/, "Le code PIN doit comporter 4 à 6 chiffres");

/** Montant XAF : entier positif ou nul, jamais de décimale. */
export const xafAmountSchema = z.number().int().nonnegative();

export const localeSchema = z.enum(["fr", "en"]);
