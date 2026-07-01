export class jsPDF {
  private lines: string[] = [];
  constructor(_options?: any) {
    // no-op stub
  }
  setFontSize(_s: number) { return this; }
  setFont(_f: string, _style?: string) { return this; }
  setTextColor(_r: number, _g?: number, _b?: number) { return this; }
  setFillColor(_r: number, _g?: number, _b?: number) { return this; }
  setDrawColor(_r: number, _g?: number, _b?: number) { return this; }
  setLineWidth(_w: number) { return this; }
  text(_t: string | string[], _x: number, _y: number, _opts?: any) { return this; }
  rect(_x: number, _y: number, _w: number, _h: number, _style?: string) { return this; }
  splitTextToSize(_text: string, _maxWidth: number): string[] { return []; }
  roundedRect(_x: number, _y: number, _w: number, _h: number, _rx: number, _ry: number, _style?: string) { return this; }
  addImage(_data: string, _format: string, _x: number, _y: number, _w: number, _h: number) { return this; }
  line(_x1: number, _y1: number, _x2: number, _y2: number) { return this; }
  addPage() { return this; }
  save(_filename: string) {
    console.warn('[PDF] jsPDF is not available in this environment. PDF download skipped.');
  }
  internal = { pageSize: { getWidth: () => 210, getHeight: () => 297 } };
}

export default function autoTable(_doc: any, _opts: any) {
  console.warn('[PDF] jsPDF autoTable is not available in this environment.');
}
