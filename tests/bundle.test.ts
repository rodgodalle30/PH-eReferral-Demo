import assert from "node:assert/strict";
import test from "node:test";
import { buildReferralBundle, extractWorkflowIds } from "../src/bundle.js";

test("builds the nine-resource transaction used by the Connectathon", () => {
  const bundle = buildReferralBundle({
    patient: { familyName:"Santos", givenName:"Maria", gender:"female", birthDate:"1988-03-12", phone:"+639000000000", addressLine:"Test", barangayCode:"1206306001", barangayName:"Assumption", cityCode:"1206306000", cityName:"Koronadal", provinceCode:"1206300000", provinceName:"South Cotabato", regionCode:"1200000000", regionName:"Region XII" },
    practitioner: { familyName:"Demo", givenName:"Rosa", licenseNumber:"TEAM04-PRC-TEST" },
    referral: { priority:"urgent", diagnosisCode:"398254007", diagnosisDisplay:"Pre-eclampsia", clinicalNotes:"Test note", reasonCode:"71388002", reasonDisplay:"Urgent referral", systolic:180, diastolic:110 }
  });
  assert.equal(bundle.resourceType, "Bundle"); assert.equal(bundle.type, "transaction"); assert.equal(bundle.entry.length, 9);
  assert.deepEqual(bundle.entry.map(item => item.resource.resourceType), ["Patient","Practitioner","Organization","Organization","PractitionerRole","Condition","Observation","ServiceRequest","Task"]);
  assert.match(bundle.entry[1]!.request.url, /TEAM04-PRC-TEST$/);
  assert.match(bundle.entry[4]!.request.url, /-TEAM04-PRC-TEST-ROLE$/);
});

test("extracts logical IDs from transaction response locations", () => {
  const ids = extractWorkflowIds({ entry: Array.from({ length: 9 }, (_, i) => ({ response: { location: `Type/id-${i}/_history/1` } })) });
  assert.equal(ids.patientId, "id-0"); assert.equal(ids.serviceRequestId, "id-7"); assert.equal(ids.taskId, "id-8");
});
