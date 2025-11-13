export function uuid(): string {
  // UUID v4 sederhana untuk sesi chatting
  // (cukup untuk demo; di produksi pakai lib uuid)
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}
