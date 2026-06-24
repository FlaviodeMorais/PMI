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
  };
  client: {
    company: string;
    zipCode: string;
    city: string;
    country: string;
  };
  material: {
    specification: string;
    equipmentDescription: string;
    invoice: string;
    heat: string;
    itemId: string;
    supplyAuthorization: string;
    itemTag: string;
  };
  test: {
    startDate: string;
    conclusionDate: string;
  };
}
