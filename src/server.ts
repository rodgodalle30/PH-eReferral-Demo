import express, { type ErrorRequestHandler } from "express";
import helmet from "helmet";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { buildReferralBundle, extractWorkflowIds } from "./bundle.js";
import { config } from "./config.js";
import { FhirHttpError, fhirRequest } from "./fhir-client.js";
import { referralSchema } from "./validation.js";

const app = express();
app.use(helmet({ contentSecurityPolicy: false }));
app.use(express.json({ limit: "1mb" }));

app.get("/api/config", (_req, res) => res.json({
  fhirBaseUrl: config.FHIR_BASE_URL, teamCode: config.TEAM_CODE,
  referringFacility: { nhfr: config.REFERRING_FACILITY_NHFR, name: config.REFERRING_FACILITY_NAME },
  receivingFacility: { nhfr: config.RECEIVING_FACILITY_NHFR, name: config.RECEIVING_FACILITY_NAME }
}));

app.get("/api/health/fhir", async (_req, res, next) => {
  try { const capability = await fhirRequest("/metadata"); res.json({ ok: true, capability }); } catch (error) { next(error); }
});

app.post("/api/referrals/preview", (req, res) => {
  const input = referralSchema.parse(req.body);
  res.json(buildReferralBundle(input));
});

app.post("/api/referrals", async (req, res, next) => {
  try {
    if ([config.REFERRING_FACILITY_NHFR, config.RECEIVING_FACILITY_NHFR].some(value => value.startsWith("SET-ME"))) {
      return res.status(400).json({ error: "Configure both facility NHFR codes in .env before sending." });
    }
    const input = referralSchema.parse(req.body);
    const bundle = buildReferralBundle(input);
    const fhirResponse = await fhirRequest("", { method: "POST", body: JSON.stringify(bundle) });
    res.status(201).json({ message: "Referral sent successfully", referralNumber: bundle.identifier.value, ids: extractWorkflowIds(fhirResponse), fhirResponse });
  } catch (error) { next(error); }
});

app.get("/api/referrals", async (req, res, next) => {
  try {
    const patientId = typeof req.query.patientId === "string" ? req.query.patientId : "";
    const query = patientId ? `?subject=${encodeURIComponent(`Patient/${patientId}`)}` : "?_count=20&_sort=-_lastUpdated";
    res.json(await fhirRequest(`/ServiceRequest${query}`));
  } catch (error) { next(error); }
});

app.get("/api/referrals/incoming", async (_req, res, next) => {
  try {
    type FhirResource = Record<string, any>;
    type SearchBundle = { entry?: Array<{ resource?: FhirResource }> };
    const entries = (value: unknown) => (value as SearchBundle)?.entry ?? [];
    const referenceId = (reference: unknown) => typeof reference === "string" ? reference.split("/").at(-1) ?? "" : "";
    const organizationSearch = await fhirRequest(`/Organization?identifier=${encodeURIComponent(`https://fhir.doh.gov.ph/phcore/Identifier/doh-nhfr-code|${config.RECEIVING_FACILITY_NHFR}`)}`);
    const receivingOrganization = entries(organizationSearch)[0]?.resource;
    if (!receivingOrganization?.id) return res.json({ referrals: [] });
    const referralSearch = await fhirRequest(`/ServiceRequest?performer=${encodeURIComponent(`Organization/${receivingOrganization.id}`)}&_count=50&_sort=-authored&_include=ServiceRequest:subject&_include=ServiceRequest:requester`);
    const resources = entries(referralSearch).map(item => item.resource).filter(Boolean) as FhirResource[];
    const byReference = new Map(resources.filter(resource => resource.id).map(resource => [`${resource.resourceType}/${resource.id}`, resource]));
    const serviceRequests = resources.filter(resource => resource.resourceType === "ServiceRequest");
    const rows = await Promise.all(serviceRequests.map(async serviceRequest => {
      const patient = byReference.get(String(serviceRequest.subject?.reference));
      const practitionerRole = byReference.get(String(serviceRequest.requester?.reference));
      const referringOrganizationId = referenceId(practitionerRole?.organization?.reference);
      const [taskSearch, referringOrganization] = await Promise.all([
        fhirRequest(`/Task?focus=${encodeURIComponent(`ServiceRequest/${serviceRequest.id}`)}&_count=1&_sort=-_lastUpdated`),
        referringOrganizationId ? fhirRequest(`/Organization/${encodeURIComponent(referringOrganizationId)}`).catch(() => null) : Promise.resolve(null)
      ]);
      const task = entries(taskSearch)[0]?.resource;
      const name = patient?.name?.[0];
      return {
        id: serviceRequest.id, referralNumber: serviceRequest.identifier?.[0]?.value ?? serviceRequest.requisition?.value ?? serviceRequest.id,
        patientName: patient ? [...(name?.given ?? []), name?.family].filter(Boolean).join(" ") : "Unknown patient", birthDate: patient?.birthDate ?? "",
        referringFacility: (referringOrganization as FhirResource | null)?.name ?? practitionerRole?.organization?.display ?? "Unknown facility",
        priority: serviceRequest.priority ?? "routine", reason: serviceRequest.reasonCode?.[0]?.text ?? serviceRequest.reasonCode?.[0]?.coding?.[0]?.display ?? "—",
        authoredOn: serviceRequest.authoredOn ?? "", status: task?.status ?? serviceRequest.status ?? "unknown", taskId: task?.id ?? "", receivingOrganizationId: receivingOrganization.id
      };
    }));
    res.json({ receivingFacility: receivingOrganization.name ?? config.RECEIVING_FACILITY_NAME, referrals: rows });
  } catch (error) { next(error); }
});

app.get("/api/referrals/:id", async (req, res, next) => {
  try {
    const serviceRequest = await fhirRequest(`/ServiceRequest/${encodeURIComponent(req.params.id)}`);
    const tasks = await fhirRequest(`/Task?focus=${encodeURIComponent(`ServiceRequest/${req.params.id}`)}`);
    res.json({ serviceRequest, tasks });
  } catch (error) { next(error); }
});

app.patch("/api/tasks/:id/status", async (req, res, next) => {
  try {
    const status = req.body?.status;
    if (!(["received", "accepted"] as const).includes(status)) return res.status(400).json({ error: "Status must be received or accepted." });
    const now = new Date().toISOString();
    const patch: unknown[] = [
      { op: "replace", path: "/status", value: status },
      { op: "replace", path: "/lastModified", value: now },
      { op: "add", path: "/note/-", value: { text: status === "received" ? "Referral received by the receiving facility. Pending review." : "Referral accepted for urgent evaluation and management." } }
    ];
    if (status === "received") patch.splice(2, 0, { op: "add", path: "/owner", value: { reference: `Organization/${req.body.receivingOrganizationId}`, display: config.RECEIVING_FACILITY_NAME } });
    res.json(await fhirRequest(`/Task/${encodeURIComponent(req.params.id)}`, {
      method: "PATCH", headers: { "Content-Type": "application/json-patch+json", Prefer: "return=representation" }, body: JSON.stringify(patch)
    }));
  } catch (error) { next(error); }
});

const here = path.dirname(fileURLToPath(import.meta.url));
// Both development and production serve the browser-ready files produced by
// the client TypeScript build. Serving src/public in development makes
// /app.js fall through to index.html because only app.ts exists there.
const publicDir = process.env.NODE_ENV === "production"
  ? path.resolve(here, "public")
  : path.resolve(here, "../dist/public");
app.use(express.static(publicDir));
app.get("/{*path}", (_req, res) => res.sendFile(path.join(publicDir, "index.html")));

const errorHandler: ErrorRequestHandler = (error, _req, res, _next) => {
  console.error(error);
  if (error instanceof FhirHttpError) return void res.status(error.status).json({ error: error.message, details: error.body });
  if (error?.name === "ZodError") return void res.status(422).json({ error: "Validation failed", details: error.issues });
  res.status(500).json({ error: error instanceof Error ? error.message : "Unexpected server error" });
};
app.use(errorHandler);

if (process.env.NODE_ENV !== "test") app.listen(config.PORT, () => console.log(`PH eReferral demo: http://localhost:${config.PORT}`));
export { app };
