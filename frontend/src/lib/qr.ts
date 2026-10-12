// qr.ts — wrapper library qrcode
import QRCode from "qrcode";

export function generateQR(text: string): Promise<string> {
  return QRCode.toDataURL(text, {
    margin: 1,
    color: { dark: "#1c1c1c", light: "#f5f5f5" },
    width: 300,
  });
}
