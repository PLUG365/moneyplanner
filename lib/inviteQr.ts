import qrcode from "qrcode-generator";

import { isInviteCodeFormat } from "@/lib/inviteCode";

/** 招待コードのQRコード行列を生成する（true=黒モジュール）。
 *  純JS実装（qrcode-generator）のためネイティブ依存はない。
 *  招待コード文字（A-Z/2-9）はQRの英数字モードに全て含まれる。 */
export function buildInviteQrMatrix(code: string): boolean[][] {
  const qr = qrcode(0, "M");
  qr.addData(code, "Alphanumeric");
  qr.make();
  const moduleCount = qr.getModuleCount();
  const matrix: boolean[][] = [];
  for (let row = 0; row < moduleCount; row++) {
    const cells: boolean[] = [];
    for (let col = 0; col < moduleCount; col++) {
      cells.push(qr.isDark(row, col));
    }
    matrix.push(cells);
  }
  return matrix;
}

/** QRスキャン結果から招待コードを取り出す。
 *  前後空白を除去し大文字化したうえで、招待コード形式（10文字。旧6文字も受理）に
 *  一致する場合のみ返す。それ以外のQR（URL等）は null。 */
export function parseScannedInviteCode(data: string): string | null {
  const normalized = data.trim().toUpperCase();
  return isInviteCodeFormat(normalized) ? normalized : null;
}
