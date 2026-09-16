type Json = Record<string, unknown>;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const form = $("#referral-form") as HTMLFormElement;
const responseJson = $("#response-json");
let latestResponse: unknown = {};

function toast(message: string, error = false) {
  const element = $("#toast"); element.textContent = message; element.className = error ? "show error" : "show";
  window.setTimeout(() => element.className = "", 3500);
}
function showResponse(data: unknown, status: string) {
  latestResponse = data; responseJson.textContent = JSON.stringify(data, null, 2); $("#response-status").textContent = status;
}
function setView(id: string) {
  document.querySelectorAll(".view,.tab").forEach(el => el.classList.remove("active"));
  document.getElementById(id)?.classList.add("active"); document.querySelector(`[data-view="${id}"]`)?.classList.add("active");
}
async function api(url: string, init?: RequestInit) {
  const response = await fetch(url, { ...init, headers: { "Content-Type": "application/json", ...init?.headers } });
  const data = await response.json().catch(() => ({ error: `HTTP ${response.status}` }));
  if (!response.ok) throw Object.assign(new Error((data as Json).error as string || `HTTP ${response.status}`), { data });
  return data;
}
function value(data: FormData, key: string) { return String(data.get(key) ?? "").trim(); }
function payload() {
  const data = new FormData(form);
  return {
    patient: {
      familyName: value(data,"familyName"), givenName: value(data,"givenName"), middleName: value(data,"middleName"),
      gender: value(data,"gender"), birthDate: value(data,"birthDate"), phone: value(data,"phone"), addressLine: value(data,"addressLine"),
      barangayCode: value(data,"barangayCode"), barangayName: value(data,"barangayName"), cityCode: value(data,"cityCode"), cityName: value(data,"cityName"),
      provinceCode: value(data,"provinceCode"), provinceName: value(data,"provinceName"), regionCode: value(data,"regionCode"), regionName: value(data,"regionName"), postalCode: value(data,"postalCode")
    },
    practitioner: { familyName: value(data,"practitionerFamilyName"), givenName: value(data,"practitionerGivenName"), licenseNumber: value(data,"licenseNumber") },
    referral: { priority: value(data,"priority"), diagnosisCode: value(data,"diagnosisCode"), diagnosisDisplay: value(data,"diagnosisDisplay"), clinicalNotes: value(data,"clinicalNotes"), reasonCode: value(data,"reasonCode"), reasonDisplay: value(data,"reasonDisplay"), systolic: Number(value(data,"systolic")), diastolic: Number(value(data,"diastolic")) }
  };
}

document.querySelectorAll<HTMLButtonElement>(".tab").forEach(button => button.addEventListener("click", () => setView(button.dataset.view!)));

form.addEventListener("submit", async event => {
  event.preventDefault(); if (!form.reportValidity()) return;
  const button = $("#send-button") as HTMLButtonElement; button.disabled = true; button.textContent = "Sending referral…";
  try {
    const result = await api("/api/referrals", { method: "POST", body: JSON.stringify(payload()) }) as Json;
    showResponse(result, "201 — Referral created and sent"); setView("response"); toast(`Referral ${result.referralNumber} sent successfully.`);
  } catch (error) { const e = error as Error & { data?: unknown }; showResponse(e.data ?? { error: e.message }, "Request failed"); setView("response"); toast(e.message, true); }
  finally { button.disabled = false; button.innerHTML = "Create &amp; Send Referral <span>→</span>"; }
});

$("#preview-button").addEventListener("click", async () => {
  if (!form.reportValidity()) return;
  try { const result = await api("/api/referrals/preview", { method: "POST", body: JSON.stringify(payload()) }); showResponse(result, "FHIR transaction Bundle preview"); setView("response"); }
  catch (error) { toast((error as Error).message, true); }
});

$("#lookup-button").addEventListener("click", async () => {
  const id = ($("#lookup-id") as HTMLInputElement).value.trim(); if (!id) return toast("Enter a ServiceRequest ID.", true);
  const panel = $("#lookup-result"); panel.className = "result-panel"; panel.textContent = "Loading…";
  try {
    const result = await api(`/api/referrals/${encodeURIComponent(id)}`) as Json; showResponse(result, `Referral ${id}`);
    const sr = result.serviceRequest as Json; const tasks = result.tasks as Json; const taskEntries = (tasks.entry as Array<Json> | undefined) ?? [];
    panel.innerHTML = `<div class="success-summary"><h3>${String(((sr.identifier as Array<Json>)?.[0]?.value) ?? `ServiceRequest/${id}`)}</h3><div class="id-grid"><div><small>SERVICE REQUEST</small><strong>${String(sr.id ?? id)}</strong></div><div><small>STATUS</small><strong>${String(sr.status ?? "unknown")}</strong></div><div><small>LINKED TASKS</small><strong>${taskEntries.length}</strong></div></div></div>`;
  } catch (error) { panel.textContent = (error as Error).message; toast((error as Error).message, true); }
});

$("#copy-response").addEventListener("click", async () => { await navigator.clipboard.writeText(JSON.stringify(latestResponse, null, 2)); toast("JSON copied to clipboard."); });

async function initialize() {
  try {
    const config = await api("/api/config") as Json; $("#fhir-url").textContent = String(config.fhirBaseUrl); $("#team-code").textContent = `Team: ${String(config.teamCode)}`;
    await api("/api/health/fhir"); $("#connection-dot").classList.add("online"); $("#connection-text").textContent = "FHIR server connected";
  } catch { $("#connection-dot").classList.add("offline"); $("#connection-text").textContent = "FHIR server unavailable"; }
}
void initialize();
