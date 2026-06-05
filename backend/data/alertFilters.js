const RESOLVED_TEXT =
  /\b(issue\s+resolved|resolved|has\s+been\s+resolved|now\s+resolved|disruption\s+ended|ended|no\s+longer\s+applies|no\s+longer\s+in\s+effect|lifted|cleared|cancelled|cancellation\s+lifted|services\s+have\s+resumed|has\s+resumed|back\s+to\s+normal|returned\s+to\s+normal)\b/i;

const GOOD_SERVICE_ONLY = /\bgood\s+service\b/i;

const ACTIVE_DISRUPTION =
  /\b(delay|late|trackwork|cancel|suspended|disruption|divert|replacement\s+bus|buses\s+replace|not\s+stopping|major|significant|avoid|emergency|planned\s+maintenance)\b/i;

export function isResolvedAlertText(title, description) {
  const blob = `${title} ${description}`;
  if (RESOLVED_TEXT.test(blob)) return true;
  if (GOOD_SERVICE_ONLY.test(blob) && !ACTIVE_DISRUPTION.test(blob)) return true;
  return false;
}
