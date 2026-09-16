import { z } from "zod";

export const referralSchema = z.object({
  patient: z.object({
    familyName: z.string().trim().min(1),
    givenName: z.string().trim().min(1),
    middleName: z.string().trim().optional(),
    gender: z.enum(["male", "female", "other", "unknown"]),
    birthDate: z.iso.date(),
    phone: z.string().trim().min(7),
    addressLine: z.string().trim().min(1),
    barangayCode: z.string().trim().min(1),
    barangayName: z.string().trim().min(1),
    cityCode: z.string().trim().min(1),
    cityName: z.string().trim().min(1),
    provinceCode: z.string().trim().min(1),
    provinceName: z.string().trim().min(1),
    regionCode: z.string().trim().min(1),
    regionName: z.string().trim().min(1),
    postalCode: z.string().trim().optional()
  }),
  practitioner: z.object({
    familyName: z.string().trim().min(1),
    givenName: z.string().trim().min(1),
    licenseNumber: z.string().trim()
      .min(1, "License / local ID is required")
      .regex(/^[A-Za-z0-9._-]+$/, "License / local ID may only contain letters, numbers, dots, underscores, and hyphens")
  }),
  referral: z.object({
    priority: z.enum(["routine", "urgent", "asap", "stat"]),
    diagnosisCode: z.string().trim().min(1),
    diagnosisDisplay: z.string().trim().min(1),
    clinicalNotes: z.string().trim().min(1),
    reasonCode: z.string().trim().min(1),
    reasonDisplay: z.string().trim().min(1),
    systolic: z.coerce.number().min(40).max(300),
    diastolic: z.coerce.number().min(20).max(200)
  })
});
