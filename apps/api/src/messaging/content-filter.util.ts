const REDACTION_PLACEHOLDER = '[masqué]';

/**
 * Numéros de téléphone / mobile money : au moins 7 chiffres, séparateurs courants
 * autorisés. Volontairement permissif (quitte à sur-filtrer) pour empêcher tout
 * contournement de la plateforme par échange de numéro.
 */
const PHONE_PATTERN = /(\+?\d[\d\s().-]{5,}\d)/g;

/** Liens WhatsApp (wa.me, whatsapp.com, chat.whatsapp.com), avec ou sans schéma. */
const WHATSAPP_LINK_PATTERN =
  /((https?:\/\/)?(www\.)?(wa\.me|chat\.whatsapp\.com|whatsapp\.com)\/\S+)/gi;

export interface FilteredContent {
  content: string;
  flagged: boolean;
}

/**
 * Filtre les numéros de téléphone/mobile money et les liens WhatsApp d'un message,
 * pour empêcher les transactions hors plateforme. Retourne le texte affiché
 * (filtré) ; le texte brut doit être conservé séparément pour audit (Message.originalContent).
 */
export function filterMessageContent(rawContent: string): FilteredContent {
  let flagged = false;

  const content = rawContent
    .replace(WHATSAPP_LINK_PATTERN, () => {
      flagged = true;
      return REDACTION_PLACEHOLDER;
    })
    .replace(PHONE_PATTERN, (match) => {
      // Un nombre isolé sans séparateur (ex: une quantité "2024") ressemble à un
      // faux positif ; on ne masque que les séquences avec au moins 7 chiffres.
      const digitCount = match.replace(/\D/g, '').length;
      if (digitCount < 7) {
        return match;
      }
      flagged = true;
      return REDACTION_PLACEHOLDER;
    });

  return { content, flagged };
}
