import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().int().positive().default(3000),
  FHIR_BASE_URL: z
    .string()
    .url()
    .default("https://cdr.pheref.fhirlab.net/fhir"),
  TEAM_CODE: z.string().min(1).default("TEAM04"),
  REFERRING_FACILITY_NHFR: z.string().min(1).default("SET-ME-REFERRING-NHFR"),
  RECEIVING_FACILITY_NHFR: z.string().min(1).default("SET-ME-RECEIVING-NHFR"),
  REFERRING_FACILITY_NAME: z
    .string()
    .min(1)
    .default("R12 Training Referring Facility"),
  RECEIVING_FACILITY_NAME: z
    .string()
    .min(1)
    .default("R12 Training Receiving Facility"),
});

export const config = schema.parse(process.env);
