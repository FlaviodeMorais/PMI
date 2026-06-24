export const REPORT_ELEMENTS = ["Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Nb", "Mo", "W"] as const;

export interface ReportReading {
  id: number;
  reading_date: string;
  reading_time: string;
  reading_number: number;
  name: string;
  descricao: string | null;
  esp_mat: string | null;
  item_id: string | null;
  n_s: string | null;
  laudo: string | null;
  pass_fail: string | null;
  match: string | null;
  alloy_1: string | null;
  alloy_2: string | null;
  unit: string | null;
  elements: Record<string, { value: number | null; tol: number | null }>;
}

export interface ReportTemplateFields {
  report: {
    number: string;
    revision: string;
    issueType: string;
  };
  client: {
    company: string;
    address: string;
    zipCode: string;
    city: string;
    country: string;
  };
  material: {
    specification: string;
    equipmentDescription: string;
    invoice: string;
    heat: string;
    nem: string;
    supplyAuthorization: string;
    itemCode: string;
    supplier: string;
    project: string;
  };
  test: {
    interpretation: string;
    procedure: string;
    equipmentType: string;
    brand: string;
    model: string;
    serialNumber: string;
    calibration: string;
    surfaceTemperature: string;
    expositionTime: string;
    surfaceConditions: string;
    surfaceCleaning: string;
    installationName: string;
    customerSite: string;
    observations: string;
    startDate: string;
    conclusionDate: string;
  };
}
