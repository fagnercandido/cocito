/**
 * Parser packs · per-service title/body parsing.
 *
 * Cada serviço de chat formata `document.title` à sua maneira. Os parsers
 * transformam um título cru num objeto estruturado {sender, channel, subject}
 * que o Cérbero/Minos pode usar sem heurística.
 */

export interface ParsedTitle {
  sender?: string;
  channel?: string;
  subject?: string;
}

export type Parser = (title: string) => ParsedTitle;

// Slack: "Sender · #channel — Workspace" · "#channel · 3 new messages · Slack"
const slack: Parser = (t) => {
  const cleaned = t.replace(/\s*\(\d+\)\s*/g, "").trim();
  // "Sender · #channel"
  const dot = cleaned.match(/^([^·]+?)\s*·\s*(#[\w-]+|DM:.+)/);
  if (dot) return { sender: dot[1].trim(), channel: dot[2].trim() };
  // "#channel · <description>"
  const chOnly = cleaned.match(/^(#[\w-]+)/);
  if (chOnly) return { channel: chOnly[1] };
  return {};
};

// Gmail: "Sender - Subject - Gmail" · "(3) Inbox - me@gmail.com - Gmail"
const gmail: Parser = (t) => {
  const cleaned = t.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*Gmail$/, "").trim();
  const parts = cleaned.split(" - ").map((p) => p.trim());
  if (parts.length >= 2) return { sender: parts[0], subject: parts.slice(1).join(" - ") };
  return { subject: cleaned };
};

// Outlook: "Sender - Subject - Outlook" · similar ao Gmail
const outlook: Parser = (t) => {
  const cleaned = t
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*-\s*Outlook$/, "")
    .replace(/\s*-\s*Microsoft Outlook$/, "")
    .trim();
  const parts = cleaned.split(" - ").map((p) => p.trim());
  if (parts.length >= 2) return { sender: parts[0], subject: parts.slice(1).join(" - ") };
  return { subject: cleaned };
};

// WhatsApp: "(N) Sender" · "WhatsApp"
const whatsapp: Parser = (t) => {
  const cleaned = t.replace(/^\(\d+\)\s*/, "").replace(/^WhatsApp\s*/, "").trim();
  return cleaned ? { sender: cleaned } : {};
};

// Telegram: "(N) Sender — Telegram Web" · "Chat Name"
const telegram: Parser = (t) => {
  const cleaned = t
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*[—–-]\s*Telegram.*$/, "")
    .trim();
  return cleaned ? { sender: cleaned } : {};
};

// Discord: "(N) #channel - server - Discord"
const discord: Parser = (t) => {
  const cleaned = t.replace(/^\(\d+\)\s*/, "").replace(/\s*-\s*Discord$/, "").trim();
  const m = cleaned.match(/^(#[\w-]+)(?:\s*-\s*(.+))?$/);
  if (m) return { channel: m[1], subject: m[2] };
  return { subject: cleaned };
};

// Teams: "(N) Sender | Channel | Microsoft Teams"
const teams: Parser = (t) => {
  const cleaned = t.replace(/^\(\d+\)\s*/, "").replace(/\s*\|\s*Microsoft Teams$/, "").trim();
  const parts = cleaned.split("|").map((p) => p.trim());
  if (parts.length >= 2) return { sender: parts[0], channel: parts[1] };
  return { subject: cleaned };
};

// Google Chat:
//   "(N) Sender - Conversa - Google Chat"
//   "(N) #room - Google Chat"
//   "Google Chat" (sem activity)
const googleChat: Parser = (t) => {
  const cleaned = t
    .replace(/^\(\d+\)\s*/, "")
    .replace(/\s*-\s*Google Chat$/, "")
    .trim();
  if (!cleaned || /^Google Chat$/i.test(cleaned)) return {};
  const parts = cleaned.split(" - ").map((p) => p.trim());
  if (parts.length >= 2) return { sender: parts[0], channel: parts[1] };
  if (parts[0].startsWith("#")) return { channel: parts[0] };
  return { sender: parts[0] };
};

// LinkedIn:
//   "(99+) Messaging | LinkedIn"
//   "(3) Sender enviou-te uma mensagem | LinkedIn"
//   "(1) New message from Sender | LinkedIn"
//   "Feed | LinkedIn" (sem activity)
const linkedin: Parser = (t) => {
  const cleaned = t
    .replace(/^\(\d+\+?\)\s*/, "")
    .replace(/\s*\|\s*LinkedIn.*$/i, "")
    .trim();
  if (!cleaned) return {};
  // EN: "New message from <sender>"
  const enMsg = cleaned.match(/^New message from\s+(.+)$/i);
  if (enMsg) return { sender: enMsg[1].trim(), channel: "Messaging" };
  // PT: "<sender> enviou-te uma mensagem" / "<sender> sent you a message"
  const ptMsg = cleaned.match(/^(.+?)\s+(?:enviou-te uma mensagem|sent you a message)/i);
  if (ptMsg) return { sender: ptMsg[1].trim(), channel: "Messaging" };
  // Genérico: secção do produto (Feed, Notifications, Messaging, …)
  if (/^(Feed|Notifications|Messaging|My Network|Jobs)$/i.test(cleaned)) {
    return { channel: cleaned };
  }
  return { subject: cleaned };
};

const PARSERS: Record<string, Parser> = {
  slack,
  gmail,
  outlook,
  whatsapp,
  telegram,
  discord,
  teams,
  "google-chat": googleChat,
  linkedin,
};

export function parseTitle(serviceId: string, title: string): ParsedTitle {
  const p = PARSERS[serviceId];
  return p ? p(title) : {};
}
