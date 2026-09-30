// Server-side validation — mirrors the rules in script.js so bad data can't bypass the browser.
import { AWARDS } from "../public/awards.js";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const PHONE_RE = /^(?:\+91|91|0)?[6-9]\d{9}$/;
const AWARD_LINKS = new Map(AWARDS.map((a) => [a.name, a.link]));

const MAX_LEN = 200;

export function validateNomination(body) {
  const src = body && typeof body === "object" ? body : {};
  const str = (v) => (typeof v === "string" ? v.trim() : "");

  const data = {
    name: str(src.name),
    company: str(src.company),
    email: str(src.email).toLowerCase(),
    phone: str(src.phone).replace(/[\s-]/g, ""),
    award: str(src.award),
  };

  const errors = {};
  if (!data.name) errors.name = "Name is required";
  if (!data.company) errors.company = "Company name is required";
  if (!data.email) errors.email = "Email is required";
  else if (!EMAIL_RE.test(data.email)) errors.email = "Please enter a valid email address";
  if (!data.phone) errors.phone = "Phone number is required";
  else if (!PHONE_RE.test(data.phone)) errors.phone = "Invalid number";
  if (!AWARD_LINKS.has(data.award)) errors.award = "Please choose an award";

  for (const [key, value] of Object.entries(data)) {
    if (value.length > MAX_LEN && !errors[key]) errors[key] = "Too long";
  }

  // The link always comes from our own list, never from the request.
  data.award_link = AWARD_LINKS.get(data.award) || "";

  return { data, errors, valid: Object.keys(errors).length === 0 };
}
