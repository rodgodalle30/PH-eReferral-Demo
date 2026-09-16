import { randomUUID } from "node:crypto";
import { config } from "./config.js";
import type { ReferralInput, WorkflowIds } from "./types.js";

const systems = {
  nhfr: "https://fhir.doh.gov.ph/phcore/Identifier/doh-nhfr-code",
  patient: "https://r12-connectathon.example/identifier/patient",
  practitioner: "https://r12-connectathon.example/identifier/practitioner",
  role: "https://r12-connectathon.example/identifier/practitioner-role",
  referral: "https://r12-connectathon.example/identifier/referral",
  condition: "https://r12-connectathon.example/identifier/condition",
  observation: "https://r12-connectathon.example/identifier/observation",
  task: "https://r12-connectathon.example/identifier/task",
  psgc: "https://psa.gov.ph/classification/psgc"
};

const profiles = {
  patient: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-patient",
  condition: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-condition",
  observation: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-observation",
  serviceRequest: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-service-request",
  task: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-task",
  practitioner: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-practitioner",
  organization: "https://fhir.doh.gov.ph/phcore/StructureDefinition/ph-core-organization",
  role: "https://fhir.doh.gov.ph/pheref/StructureDefinition/ereferral-practitioner-role"
};

function urn() { return `urn:uuid:${randomUUID()}`; }
function identifier(system: string, value: string) { return [{ system, value }]; }

export function buildReferralBundle(input: ReferralInput) {
  const now = new Date().toISOString();
  const runId = `${Date.now()}-${randomUUID().slice(0, 8)}`;
  const id = {
    patient: urn(), practitioner: urn(), referringOrg: urn(), receivingOrg: urn(),
    role: urn(), condition: urn(), observation: urn(), serviceRequest: urn(), task: urn()
  };
  const code = config.TEAM_CODE;
  const practitionerIdentifier = input.practitioner.licenseNumber;
  const practitionerRoleIdentifier = `${code}-${practitionerIdentifier}-ROLE`;
  const referralNumber = `R12-${code}-${runId}`;
  const entry = (fullUrl: string, resource: Record<string, unknown>, url: string) => ({
    fullUrl, resource, request: { method: "PUT", url }
  });

  return {
    resourceType: "Bundle", type: "transaction", timestamp: now,
    identifier: { system: systems.referral, value: referralNumber },
    entry: [
      entry(id.patient, {
        resourceType: "Patient", meta: { profile: [profiles.patient] },
        identifier: identifier(systems.patient, `${code}-PATIENT-${runId}`), active: true,
        name: [{ use: "official", family: input.patient.familyName, given: [input.patient.givenName, input.patient.middleName].filter(Boolean) }],
        telecom: [{ system: "phone", value: input.patient.phone, use: "mobile" }],
        gender: input.patient.gender, birthDate: input.patient.birthDate,
        address: [{
          extension: [
            ["region", input.patient.regionCode, input.patient.regionName],
            ["province", input.patient.provinceCode, input.patient.provinceName],
            ["city-municipality", input.patient.cityCode, input.patient.cityName],
            ["barangay", input.patient.barangayCode, input.patient.barangayName]
          ].map(([part, codeValue, display]) => ({ url: `https://fhir.doh.gov.ph/phcore/StructureDefinition/${part}`, valueCoding: { system: systems.psgc, code: codeValue, display } })),
          use: "home", line: [input.patient.addressLine], postalCode: input.patient.postalCode, country: "PH"
        }]
      }, `Patient?identifier=${systems.patient}|${code}-PATIENT-${runId}`),
      entry(id.practitioner, {
        resourceType: "Practitioner", meta: { profile: [profiles.practitioner] },
        identifier: identifier(systems.practitioner, practitionerIdentifier), active: true,
        name: [{ use: "official", family: input.practitioner.familyName, given: [input.practitioner.givenName], prefix: ["Dr."] }]
      }, `Practitioner?identifier=${systems.practitioner}|${practitionerIdentifier}`),
      entry(id.referringOrg, {
        resourceType: "Organization", meta: { profile: [profiles.organization] },
        identifier: identifier(systems.nhfr, config.REFERRING_FACILITY_NHFR), active: true, name: config.REFERRING_FACILITY_NAME
      }, `Organization?identifier=${systems.nhfr}|${config.REFERRING_FACILITY_NHFR}`),
      entry(id.receivingOrg, {
        resourceType: "Organization", meta: { profile: [profiles.organization] },
        identifier: identifier(systems.nhfr, config.RECEIVING_FACILITY_NHFR), active: true, name: config.RECEIVING_FACILITY_NAME
      }, `Organization?identifier=${systems.nhfr}|${config.RECEIVING_FACILITY_NHFR}`),
      entry(id.role, {
        resourceType: "PractitionerRole", meta: { profile: [profiles.role] },
        identifier: identifier(systems.role, practitionerRoleIdentifier), active: true,
        practitioner: { reference: id.practitioner }, organization: { reference: id.referringOrg },
        code: [{ coding: [{ system: "http://snomed.info/sct", code: "158965000", display: "Medical practitioner" }] }]
      }, `PractitionerRole?identifier=${systems.role}|${practitionerRoleIdentifier}`),
      entry(id.condition, {
        resourceType: "Condition", meta: { profile: [profiles.condition] },
        identifier: identifier(systems.condition, `${code}-CONDITION-${runId}`),
        clinicalStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-clinical", code: "active" }] },
        verificationStatus: { coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-ver-status", code: "provisional", display: "Provisional" }] },
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/condition-category", code: "encounter-diagnosis", display: "Encounter Diagnosis" }] }],
        code: { coding: [{ system: "http://snomed.info/sct", code: input.referral.diagnosisCode, display: input.referral.diagnosisDisplay }], text: input.referral.diagnosisDisplay },
        subject: { reference: id.patient }, note: [{ text: input.referral.clinicalNotes }]
      }, `Condition?identifier=${systems.condition}|${code}-CONDITION-${runId}`),
      entry(id.observation, {
        resourceType: "Observation", meta: { profile: [profiles.observation] },
        identifier: identifier(systems.observation, `${code}-BP-${runId}`), status: "final",
        category: [{ coding: [{ system: "http://terminology.hl7.org/CodeSystem/observation-category", code: "vital-signs", display: "Vital Signs" }] }],
        code: { coding: [{ system: "http://loinc.org", code: "85354-9", display: "Blood pressure panel with all children optional" }] },
        subject: { reference: id.patient }, effectiveDateTime: now,
        component: [
          { code: { coding: [{ system: "http://loinc.org", code: "8480-6", display: "Systolic blood pressure" }] }, valueQuantity: { value: input.referral.systolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" } },
          { code: { coding: [{ system: "http://loinc.org", code: "8462-4", display: "Diastolic blood pressure" }] }, valueQuantity: { value: input.referral.diastolic, unit: "mmHg", system: "http://unitsofmeasure.org", code: "mm[Hg]" } }
        ]
      }, `Observation?identifier=${systems.observation}|${code}-BP-${runId}`),
      entry(id.serviceRequest, {
        resourceType: "ServiceRequest", meta: { profile: [profiles.serviceRequest] },
        identifier: identifier(systems.referral, referralNumber), requisition: { system: systems.referral, value: referralNumber },
        status: "active", intent: "order", priority: input.referral.priority,
        category: [{ coding: [{ system: "http://snomed.info/sct", code: "73770003", display: "Hospital-based outpatient emergency care center" }], text: "Emergency" }],
        subject: { reference: id.patient }, occurrenceDateTime: now, authoredOn: now,
        requester: { reference: id.role }, performer: [{ reference: id.receivingOrg }],
        reasonCode: [{ coding: [{ system: "http://snomed.info/sct", code: input.referral.reasonCode, display: input.referral.reasonDisplay }], text: input.referral.reasonDisplay }],
        reasonReference: [{ reference: id.condition }], supportingInfo: [{ reference: id.observation }],
        note: [{ text: input.referral.clinicalNotes }]
      }, `ServiceRequest?identifier=${systems.referral}|${referralNumber}`),
      entry(id.task, {
        resourceType: "Task", meta: { profile: [profiles.task] },
        identifier: identifier(systems.task, `${code}-TASK-${runId}`), status: "requested", intent: "order",
        code: { coding: [{ system: "http://snomed.info/sct", code: "3457005", display: "Patient referral" }], text: "R12 Connectathon eReferral" },
        focus: { reference: id.serviceRequest }, for: { reference: id.patient }, authoredOn: now, lastModified: now,
        requester: { reference: id.role }, note: [{ text: "Referral sent. Awaiting receiving-facility acknowledgement." }]
      }, `Task?identifier=${systems.task}|${code}-TASK-${runId}`)
    ]
  };
}

export function extractWorkflowIds(response: unknown): WorkflowIds {
  if (!response || typeof response !== "object") return {};
  const entries = (response as { entry?: Array<{ response?: { location?: string } }> }).entry ?? [];
  const keys: (keyof WorkflowIds)[] = ["patientId", "practitionerId", "referringOrganizationId", "receivingOrganizationId", "practitionerRoleId", "conditionId", "observationId", "serviceRequestId", "taskId"];
  return Object.fromEntries(keys.map((key, index) => {
    const location = entries[index]?.response?.location?.split("/_history/")[0];
    return [key, location?.split("/").filter(Boolean).at(-1)];
  }).filter(([, value]) => value)) as WorkflowIds;
}
