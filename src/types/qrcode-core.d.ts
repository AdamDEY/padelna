// The `qrcode` package's main entry needs Node or a browser; its core is plain JavaScript
// and only builds the grid of modules, which is all we need to draw the code ourselves.
declare module "qrcode/lib/core/qrcode" {
  type QrCode = {
    modules: { size: number; get(row: number, column: number): number };
  };
  const core: {
    create(text: string, options?: { errorCorrectionLevel?: "L" | "M" | "Q" | "H" }): QrCode;
  };
  export = core;
}
