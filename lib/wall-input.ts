// This adapter accepts only normalized points; it never substitutes missing depth.
export function wallPoint(data: unknown): {x:number;y:number;active:boolean} | null {
  if (!data || typeof data !== 'object' || !('type' in data) || data.type !== 'living-wall-hand') return null;
  const d = data as {active?:unknown;x?:unknown;y?:unknown};
  const valid = d.active === true && typeof d.x === 'number' && typeof d.y === 'number' && Number.isFinite(d.x) && Number.isFinite(d.y) && d.x >= 0 && d.x <= 1 && d.y >= 0 && d.y <= 1;
  return valid ? {x:d.x as number,y:d.y as number,active:true} : {x:.5,y:.5,active:false};
}
