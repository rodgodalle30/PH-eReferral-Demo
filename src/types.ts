export interface ReferralInput {
  patient: {
    familyName: string;
    givenName: string;
    middleName?: string;
    gender: "male" | "female" | "other" | "unknown";
    birthDate: string;
    phone: string;
    addressLine: string;
    barangayCode: string;
    barangayName: string;
    cityCode: string;
    cityName: string;
    provinceCode: string;
    provinceName: string;
    regionCode: string;
    regionName: string;
    postalCode?: string;
  };
  practitioner: { familyName: string; givenName: string; licenseNumber: string };
  referral: {
    priority: "routine" | "urgent" | "asap" | "stat";
    diagnosisCode: string;
    diagnosisDisplay: string;
    clinicalNotes: string;
    reasonCode: string;
    reasonDisplay: string;
    systolic: number;
    diastolic: number;
  };
}

export interface WorkflowIds {
  patientId?: string;
  practitionerId?: string;
  referringOrganizationId?: string;
  receivingOrganizationId?: string;
  practitionerRoleId?: string;
  conditionId?: string;
  observationId?: string;
  serviceRequestId?: string;
  taskId?: string;
}
