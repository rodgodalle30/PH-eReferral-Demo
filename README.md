# PH eReferral R12 Connectathon Demo

A complete Node.js + Express + TypeScript demonstration app based on the supplied **R12 PeRef Guided Connectathon v2** Postman collection. It sends a FHIR R4 transaction Bundle containing all nine linked referral resources.

## What it demonstrates

- FHIR server CapabilityStatement connection test
- Referral form with patient, PSGC address, practitioner, diagnosis, blood pressure, and referral details
- Atomic create-and-send transaction for Patient, Practitioner, referring/receiving Organization, PractitionerRole, Condition, Observation, ServiceRequest, and Task
- Conditional `PUT` URLs to avoid accidental duplicates during a run
- Automatic extraction of server-assigned Patient, ServiceRequest, and Task IDs
- Referral lookup using ServiceRequest and Task search
- Backend endpoints for Task `received` and `accepted` transitions
- FHIR Bundle preview and full JSON response viewer

## Requirements

- Node.js 20 or newer
- Network access to the Connectathon FHIR endpoint
- Your assigned referring and receiving facility NHFR codes

## Setup

```bash
./install.sh
```

Edit `.env` and replace both `SET-ME-...` values with the NHFR codes assigned to your team:

```env
TEAM_CODE=TEAM04
REFERRING_FACILITY_NHFR=YOUR-REFERRING-NHFR
RECEIVING_FACILITY_NHFR=YOUR-RECEIVING-NHFR
```

Run in development:

```bash
./run.sh
```

Open <http://localhost:{PORT}>.


## Local REST API

| Method | Endpoint | Purpose |
| --- | --- | --- |
| GET | `/api/health/fhir` | Test the remote FHIR CapabilityStatement |
| POST | `/api/referrals/preview` | Build the transaction without sending it |
| POST | `/api/referrals` | Create and send the complete referral transaction |
| GET | `/api/referrals/:id` | Read a ServiceRequest and linked Task(s) |
| PATCH | `/api/tasks/:id/status` | Set a Task to `received` or `accepted` |

## Important

This is a Connectathon/demo implementation, not a production clinical system. Before production use, add your organization's authentication, user authorization, audit logging, consent/privacy controls, terminology validation, durable database storage, encryption/key management, monitoring, and formal conformance/security testing.
