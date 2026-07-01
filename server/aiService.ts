const AI_SERVICE_URL =
  process.env.AI_SERVICE_URL ||
  "https://itsmyfavoriteworkplace-bookmyslot-ai-service.hf.space";

export interface XrayLocation {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface XrayFinding {
  class_id: number;
  label: string;
  confidence: number;
  location: XrayLocation;
}

export interface XrayAnalysis {
  findings: XrayFinding[];
}

export interface AnalyseResponse {
  success: boolean;
  analysis: XrayAnalysis | null;
  message: string | null;
}

export async function isAiServiceHealthy(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 10_000);
    const response = await fetch(`${AI_SERVICE_URL}/`, {
      signal: controller.signal,
    });
    clearTimeout(timeout);
    const data = (await response.json()) as { status: string };
    return data.status === "running";
  } catch {
    return false;
  }
}

export async function analyseXray(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<AnalyseResponse> {
  const form = new FormData();
  form.append("file", new Blob([imageBuffer], { type: mimeType }), filename);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 90_000);

  try {
    const response = await fetch(`${AI_SERVICE_URL}/analyse-xray`, {
      method: "POST",
      body: form,
      signal: controller.signal,
    });

    if (!response.ok) {
      throw new Error(`AI service HTTP error: ${response.status}`);
    }

    return (await response.json()) as AnalyseResponse;
  } finally {
    clearTimeout(timeout);
  }
}

export async function wakeAndAnalyse(
  imageBuffer: Buffer,
  filename: string,
  mimeType: string
): Promise<AnalyseResponse> {
  const healthy = await isAiServiceHealthy();
  if (!healthy) {
    await new Promise((resolve) => setTimeout(resolve, 5_000));
  }
  return analyseXray(imageBuffer, filename, mimeType);
}
