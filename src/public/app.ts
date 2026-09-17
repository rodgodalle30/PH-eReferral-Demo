type Json = Record<string, unknown>;
const $ = <T extends HTMLElement>(selector: string) => document.querySelector<T>(selector)!;
const form = $("#referral-form") as HTMLFormElement;
const responseJson = $("#response-json");
let latestResponse: unknown = {};
type IncomingReferral = { id:string; referralNumber:string; patientName:string; birthDate:string; referringFacility:string; priority:string; reason:string; authoredOn:string; status:string; taskId:string; receivingOrganizationId:string };
let incomingReferrals: IncomingReferral[] = [];

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

document.querySelectorAll<HTMLButtonElement>(".tab").forEach(button => button.addEventListener("click", () => {
  setView(button.dataset.view!);
  if (button.dataset.view === "incoming") void loadIncomingReferrals();
}));

function formatDate(value: string) {
  if (!value) return "—";
  const date = new Date(value);
  return Number.isNaN(date.valueOf()) ? value : new Intl.DateTimeFormat("en-PH", { dateStyle:"medium", timeStyle:"short" }).format(date);
}
function renderIncomingReferrals() {
  const status = ($("#incoming-status") as HTMLSelectElement).value;
  const referrals = incomingReferrals.filter(item => status === "all" || item.status === status);
  $("#incoming-count").textContent = `${referrals.length} referral${referrals.length === 1 ? "" : "s"}`;
  const body = $("#incoming-rows"); body.replaceChildren();
  if (!referrals.length) {
    const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 8; cell.className = "table-message";
    cell.textContent = incomingReferrals.length ? "No referrals match this status." : "No incoming referrals found."; row.append(cell); body.append(row); return;
  }
  for (const referral of referrals) {
    const row = document.createElement("tr");
    const values = [referral.referralNumber, referral.patientName, referral.referringFacility, referral.reason, referral.priority, formatDate(referral.authoredOn), referral.status];
    values.forEach((text, index) => {
      const cell = document.createElement("td"); cell.textContent = text;
      if (index === 0) cell.className = "referral-id";
      if (index === 4) cell.className = `priority ${referral.priority}`;
      if (index === 6) { cell.textContent = ""; const badge = document.createElement("span"); badge.className = `status ${referral.status}`; badge.textContent = referral.status; cell.append(badge); }
      row.append(cell);
    });
    const action = document.createElement("td");
    if (referral.taskId && ["requested", "received"].includes(referral.status)) {
      const button = document.createElement("button"); button.className = "small";
      const nextStatus = referral.status === "requested" ? "received" : "accepted"; button.textContent = nextStatus === "received" ? "Mark received" : "Accept";
      button.addEventListener("click", async () => {
        button.disabled = true;
        try { await api(`/api/tasks/${encodeURIComponent(referral.taskId)}/status`, { method:"PATCH", body:JSON.stringify({ status:nextStatus, receivingOrganizationId:referral.receivingOrganizationId }) }); toast(`Referral marked ${nextStatus}.`); await loadIncomingReferrals(); }
        catch (error) { toast((error as Error).message, true); button.disabled = false; }
      }); action.append(button);
    } else action.textContent = "—";
    row.append(action); body.append(row);
  }
}
async function loadIncomingReferrals() {
  const button = $("#refresh-incoming") as HTMLButtonElement; button.disabled = true;
  $("#incoming-rows").innerHTML = '<tr><td colspan="8" class="table-message">Loading referrals…</td></tr>';
  try {
    const result = await api("/api/referrals/incoming") as Json; incomingReferrals = (result.referrals as IncomingReferral[]) ?? [];
    $("#incoming-subtitle").textContent = `Referrals sent to ${String(result.receivingFacility ?? "your facility")}`; renderIncomingReferrals();
  } catch (error) { $("#incoming-rows").textContent = ""; const row = document.createElement("tr"); const cell = document.createElement("td"); cell.colSpan = 8; cell.className = "table-message error-message"; cell.textContent = (error as Error).message; row.append(cell); $("#incoming-rows").append(row); toast((error as Error).message, true); }
  finally { button.disabled = false; }
}
$("#refresh-incoming").addEventListener("click", () => void loadIncomingReferrals());
$("#incoming-status").addEventListener("change", renderIncomingReferrals);

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

async function loadReferral(id: string) {
  const panel = $("#lookup-result"); panel.className = "result-panel"; panel.textContent = "Loading…";
  try {
    const result = await api(`/api/referrals/${encodeURIComponent(id)}`) as Json; showResponse(result, `Referral ${id}`);
    const sr = result.serviceRequest as Json; const tasks = result.tasks as Json; const taskEntries = (tasks.entry as Array<Json> | undefined) ?? [];
    const task = taskEntries[0]?.resource as Json | undefined;
    const taskStatus = String(task?.status ?? "not found");
    const taskId = String(task?.id ?? "");
    const performer = (sr.performer as Array<Json> | undefined)?.[0];
    const receivingOrganizationId = String(performer?.reference ?? "").split("/").at(-1) ?? "";
    const referralNumber = String(((sr.identifier as Array<Json>)?.[0]?.value) ?? `ServiceRequest/${id}`);
    panel.replaceChildren();
    const summary = document.createElement("div"); summary.className = "success-summary";
    const heading = document.createElement("h3"); heading.textContent = referralNumber; summary.append(heading);
    const grid = document.createElement("div"); grid.className = "id-grid";
    for (const [label, display] of [["SERVICE REQUEST", String(sr.id ?? id)], ["SERVICE REQUEST STATUS", String(sr.status ?? "unknown")], ["TASK STATUS", taskStatus]]) {
      const cell = document.createElement("div"); const small = document.createElement("small"); const strong = document.createElement("strong");
      small.textContent = label; strong.textContent = display; cell.append(small, strong); grid.append(cell);
    }
    summary.append(grid);
    if (taskId && (taskStatus === "requested" || taskStatus === "received")) {
      const actions = document.createElement("div"); actions.className = "workflow-actions";
      const button = document.createElement("button");
      const nextStatus = taskStatus === "requested" ? "received" : "accepted";
      button.textContent = nextStatus === "received" ? "Mark as Received" : "Accept Referral";
      button.addEventListener("click", async () => {
        button.disabled = true; button.textContent = nextStatus === "received" ? "Marking received…" : "Accepting…";
        try {
          const updated = await api(`/api/tasks/${encodeURIComponent(taskId)}/status`, {
            method: "PATCH", body: JSON.stringify({ status: nextStatus, receivingOrganizationId })
          });
          showResponse(updated, `Task ${taskId} marked ${nextStatus}`); toast(`Referral ${nextStatus}.`); await loadReferral(id);
        } catch (error) { const e = error as Error & { data?: unknown }; showResponse(e.data ?? { error: e.message }, "Status update failed"); toast(e.message, true); button.disabled = false; }
      });
      actions.append(button); summary.append(actions);
    }
    panel.append(summary);
  } catch (error) { panel.textContent = (error as Error).message; toast((error as Error).message, true); }
}

$("#lookup-button").addEventListener("click", async () => {
  const id = ($("#lookup-id") as HTMLInputElement).value.trim(); if (!id) return toast("Enter a ServiceRequest ID.", true);
  await loadReferral(id);
});

$("#copy-response").addEventListener("click", async () => { await navigator.clipboard.writeText(JSON.stringify(latestResponse, null, 2)); toast("JSON copied to clipboard."); });

async function initialize() {
  try {
    const config = await api("/api/config") as Json; $("#fhir-url").textContent = String(config.fhirBaseUrl); $("#team-code").textContent = `Team: ${String(config.teamCode)}`;
    await api("/api/health/fhir"); $("#connection-dot").classList.add("online"); $("#connection-text").textContent = "FHIR server connected";
  } catch { $("#connection-dot").classList.add("offline"); $("#connection-text").textContent = "FHIR server unavailable"; }
}
void initialize();
