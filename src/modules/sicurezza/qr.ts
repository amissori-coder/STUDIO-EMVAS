import "server-only";
import QRCode from "qrcode";

/** Codice QR in SVG, generato sul server: il segreto non passa da servizi esterni. */
export async function qrSvg(testo: string) {
  return QRCode.toString(testo, { type: "svg", errorCorrectionLevel: "M", margin: 1, color: { dark: "#0f172a", light: "#ffffff" } });
}
