// NASA GEOS-FP tavg3_2d_aer_Nx: DUSMASS kg/m³, DUEXTTAU dimensionless.
// Time is anchored to grads_min: GrADS' historical day count is not JS's
// proleptic Gregorian ordinal, so treating its numeric origin literally is wrong.
export function readDustMetadata(text) {
  const time = text.match(/\btime\s*\{([^}]+)\}/)?.[1] || '';
  const first = time.match(/grads_min\s+"(\d{2}):(\d{2})z(\d{2})([a-z]{3})(\d{4})"/);
  const count = Number(time.match(/grads_size\s+"(\d+)"/)?.[1]);
  const step = Number(time.match(/grads_step\s+"(\d+)mn"/)?.[1]);
  if (!first || !Number.isInteger(count) || count < 2 || count > 256 || step !== 180) throw new Error('Unexpected NASA forecast time grid');
  const month = ['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(first[4]);
  if (month < 0) throw new Error('Invalid NASA month');
  return { count, step, start: Date.UTC(+first[5], month, +first[3], +first[1], +first[2]) };
}

export function readDustAscii(text, meta) {
  const field = name => {
    const block = text.split(`${name}, [${meta.count}][1][1]\n`)[1]?.split('\ntime,')[0];
    if (!block) throw new Error(`Missing NASA ${name}`);
    const rows = [...block.matchAll(/^\[(\d+)\]\[0\],\s*([\d.Ee+\-]+)/gm)];
    if (rows.length !== meta.count || rows.some((r, i) => +r[1] !== i)) throw new Error(`Incomplete NASA ${name}`);
    const values = rows.map(r => Number(r[2]));
    if (values.some(n => !Number.isFinite(n) || n < 0 || n >= 1e14)) throw new Error(`Invalid NASA ${name}`);
    return values;
  };
  const mass = field('dusmass');
  const optical = field('duexttau');
  const lat = Number(text.match(/\nlat, \[1\]\s*\n([^\n]+)/)?.[1]);
  const lon = Number(text.match(/\nlon, \[1\]\s*\n([^\n]+)/)?.[1]);
  if (lat !== 25.25 || lon !== 55.3125) throw new Error('NASA grid point changed');
  return mass.map((value, i) => {
    if (value * 1e9 > 100000 || optical[i] > 20) throw new Error('NASA values exceed plausible model range');
    return { time: new Date(meta.start + i * meta.step * 60000).toISOString(), dustUgM3: Math.round(value * 1e9 * 10) / 10, opticalDepth: +optical[i].toFixed(4) };
  });
}
