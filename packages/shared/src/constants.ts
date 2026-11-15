export const DEFAULT_CURRENCY = "XAF" as const;

export const SUPPORTED_LOCALES = ["fr", "en"] as const;
export type SupportedLocale = (typeof SUPPORTED_LOCALES)[number];

export const DEFAULT_LOCALE: SupportedLocale = "fr";

export const APP_DISPLAY_TIMEZONE = "Africa/Douala" as const;

/** Indicatifs téléphoniques CEMAC acceptés à l'inscription (Cameroun par défaut). */
export const CEMAC_PHONE_PREFIXES = [
  "+237", // Cameroun
  "+241", // Gabon
  "+236", // Centrafrique
  "+235", // Tchad
  "+242", // Congo
  "+240", // Guinée équatoriale
] as const;

export const DEFAULT_PHONE_PREFIX = "+237" as const;

export const MIN_WITHDRAWAL_AMOUNT_XAF = 500;

export const WITHDRAWAL_FEE_FREE_THRESHOLD_XAF = 5_000;
export const WITHDRAWAL_FEE_BELOW_THRESHOLD_XAF = 100;

export const GIFT_CARD_MONTHLY_CAP_BEFORE_KYC_XAF = 300_000;
export const KYC_TRIGGER_CUMULATIVE_SALES_XAF = 100_000;

export const SUBSCRIPTION_CO_MEMBER_FLAT_FEE_XAF = 250;
export const SUBSCRIPTION_CO_MEMBER_PERCENT_FEE = 0.05;
export const GIFT_CARD_SALE_PERCENT_FEE = 0.08;
export const PREMIUM_MONTHLY_FEE_XAF = 1_000;
export const PREMIUM_FEE_DISCOUNT_MULTIPLIER = 0.5;

export const SUBSCRIPTION_ESCROW_RELEASE_HOURS = 48;
export const GIFT_CARD_ESCROW_RELEASE_HOURS = 72;
export const DISPUTE_RESPONSE_WINDOW_HOURS = 48;
export const DISPUTE_ARBITRATION_WINDOW_HOURS = 72;
export const PAYMENT_REMINDER_DAYS_BEFORE_DUE = 3;
