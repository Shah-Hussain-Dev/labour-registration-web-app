import { z } from "zod";
import { DEFAULT_MEMBER_RELATION, MEMBER_RELATION_OPTIONS } from "../api/labourService.js";

export const MOBILE_DIGITS = 10;
export const NAME_MAX = 150;
export const ADDRESS_MAX = 500;

const LABOUR_ID_RE = /^[\dA-Za-z\-]{4,32}$/;
const BARCODE_RE = /^[A-Za-z0-9\-]{3,64}$/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const GENDER_VALUES = ["male", "female", "other", "prefer_not"];
const NAME_NO_DIGITS_RE = /^[^\d]*$/;

/** Completed years from a valid YYYY-MM-DD on or before today; otherwise null. */
export function completedYearsFromDobIso(iso) {
  const s = String(iso || "").trim();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return null;
  const d = new Date(`${s}T12:00:00`);
  if (Number.isNaN(d.getTime())) return null;
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return null;
  let age = today.getFullYear() - d.getFullYear();
  const m = today.getMonth() - d.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1;
  return age;
}

export function validateDob(iso) {
  if (!String(iso || "").trim()) return "Date of birth is required";
  if (!/^\d{4}-\d{2}-\d{2}$/.test(iso)) return "Enter a valid date";
  const d = new Date(`${iso}T12:00:00`);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  const today = new Date();
  today.setHours(23, 59, 59, 999);
  if (d > today) return "Date of birth cannot be in the future";
  if (completedYearsFromDobIso(iso) === null) return "Invalid date";
  return "";
}

export function getMobileValidationError(mobile, countryCode = "+91") {
  const digits = String(mobile || "").replace(/\D/g, "");
  if (!digits) return "";
  const ccBare = String(countryCode || "+91")
    .trim()
    .replace(/^\+/, "");
  if (digits.length > MOBILE_DIGITS) {
    return `Mobile number must be at most ${MOBILE_DIGITS} digits`;
  }
  if (ccBare === "91" || ccBare === "") {
    if (digits.length !== MOBILE_DIGITS) {
      return `Enter exactly ${MOBILE_DIGITS} digits`;
    }
    return "";
  }
  if (digits.length < 8 || digits.length > MOBILE_DIGITS) {
    return `Enter ${MOBILE_DIGITS} digits for this country code`;
  }
  return "";
}

export function getDefaultFormValues(overrides = {}) {
  return {
    labourId: "",
    name: "",
    countryCode: "+91",
    mobile: "",
    aadhaar: "",
    email: "",
    address: "",
    dob: "",
    gender: "",
    mappedBarcode: "",
    memberRelation: "",
    ...overrides,
  };
}

export function getManualDefaultFormValues() {
  return getDefaultFormValues({ memberRelation: DEFAULT_MEMBER_RELATION });
}

/**
 * @param {{ requireRelation?: boolean }} options
 */
export function createLabourRegistrationSchema(options = {}) {
  const { requireRelation = false } = options;

  return z
    .object({
      labourId: z
        .string()
        .trim()
        .min(1, "Labour ID is required")
        .regex(LABOUR_ID_RE, "Use 4–32 letters, digits, or hyphens"),
      name: z
        .string()
        .trim()
        .min(1, "Name is required")
        .min(2, "Name must be at least 2 characters")
        .max(NAME_MAX, `Name must be at most ${NAME_MAX} characters`)
        .regex(NAME_NO_DIGITS_RE, "Name cannot contain numbers"),
      countryCode: z.string().default("+91"),
      mobile: z.string().default(""),
      aadhaar: z
        .string()
        .transform((v) => v.replace(/\s/g, ""))
        .pipe(
          z
            .string()
            .min(1, "Aadhaar is required")
            .regex(/^\d{12}$/, "Enter exactly 12 digits"),
        ),
      email: z.string().default(""),
      address: z
        .string()
        .max(ADDRESS_MAX, `Address must be at most ${ADDRESS_MAX} characters`),
      dob: z.string().superRefine((value, ctx) => {
        const message = validateDob(value);
        if (message) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, message });
        }
      }),
      gender: z
        .string()
        .min(1, "Select gender")
        .refine((v) => GENDER_VALUES.includes(v), { message: "Select gender" }),
      mappedBarcode: z
        .string()
        .trim()
        .min(1, "Barcode is required")
        .regex(BARCODE_RE, "Use 3–64 characters: letters, digits, or hyphens"),
      memberRelation: z.string().default(""),
    })
    .superRefine((data, ctx) => {
      if (requireRelation) {
        if (!String(data.memberRelation || "").trim()) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select relation",
            path: ["memberRelation"],
          });
        } else if (!MEMBER_RELATION_OPTIONS.includes(data.memberRelation)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            message: "Select relation",
            path: ["memberRelation"],
          });
        }
      }

      const email = String(data.email || "").trim();
      if (email && !EMAIL_RE.test(email)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Enter a valid email address",
          path: ["email"],
        });
      }

      const mobileTrim = String(data.mobile || "").trim();
      if (!mobileTrim) return;

      const ccBare = String(data.countryCode || "+91")
        .trim()
        .replace(/^\+/, "");
      if (!ccBare) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Country code is required when mobile is entered",
          path: ["countryCode"],
        });
        return;
      }
      if (!/^\d{1,4}$/.test(ccBare)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Use digits only (e.g. 91)",
          path: ["countryCode"],
        });
        return;
      }

      const mobileErr = getMobileValidationError(data.mobile, data.countryCode);
      if (mobileErr) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: mobileErr,
          path: ["mobile"],
        });
      }
    });
}
