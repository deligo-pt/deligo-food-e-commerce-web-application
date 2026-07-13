import axios from "axios";
import { apiClient, getApiErrorMessage } from "./apiClient";

/**
 * Fetches an order's server-rendered invoice PDF and triggers a browser
 * download. The backend streams `application/pdf`, so we request it as a blob
 * (Bearer auth + 401 handling come from apiClient). The generation can take a
 * moment, so the timeout is raised beyond the client default.
 */
export async function downloadInvoice(orderId: string): Promise<void> {
  const res = await apiClient.get(`/orders/${orderId}/download-invoice-pdf`, {
    responseType: "blob",
    headers: { Accept: "application/pdf" },
    timeout: 60000,
  });

  const blob = new Blob([res.data], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `invoice-${orderId}.pdf`;
  document.body.appendChild(link);
  link.click();
  link.remove();
  URL.revokeObjectURL(url);
}

/**
 * When a blob request fails, the JSON error body arrives as a Blob, so the
 * usual getApiErrorMessage can't read it. Parse the blob text to surface the
 * backend message; fall back to the standard extractor for non-blob errors.
 */
export async function extractBlobErrorMessage(
  error: unknown,
  fallback: string,
): Promise<string> {
  if (axios.isAxiosError(error) && error.response?.data instanceof Blob) {
    try {
      const text = await error.response.data.text();
      const json = JSON.parse(text);
      return json?.errorSources?.[0]?.message || json?.message || fallback;
    } catch {
      return fallback;
    }
  }
  return getApiErrorMessage(error, fallback);
}
