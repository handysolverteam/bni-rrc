/**
 * Client-safe formatting helpers for the chat UI (adapted from bni-go-green-app
 * numberUtils/whatsappUtils). No server-only imports allowed here.
 */

export function formatDecimal(value: unknown, decimals = 1): string {
  if (value === undefined || value === null || value === "") return "0";
  const num = Number(value);
  if (Number.isNaN(num)) return "0";
  const rounded =
    Math.round(num * Math.pow(10, decimals)) / Math.pow(10, decimals);
  return rounded.toString();
}

export function formatCurrency(value: unknown): string {
  if (value === undefined || value === null || value === "") return "₹0";
  const num = Number(value);
  if (Number.isNaN(num)) return "₹0";
  return `₹${num.toLocaleString("en-IN")}`;
}

/** Opens WhatsApp with the given text (no recipient) on mobile, WhatsApp Web otherwise. */
export function getWhatsAppUrl(text: string): string {
  const encoded = encodeURIComponent(text.trim());
  const isMobile =
    typeof navigator !== "undefined" &&
    /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
      navigator.userAgent,
    );

  return isMobile
    ? `whatsapp://send?text=${encoded}`
    : `https://web.whatsapp.com/send?text=${encoded}`;
}