// Local metric frame centred on Tampa Bay. 1 unit = 1 m. +x east, −z north.
export const LAT0 = 27.75, LON0 = -82.55;
export const KX = 111320 * Math.cos(LAT0 * Math.PI / 180), KZ = 110574;
export const toXZ = (lat, lon) => [(lon - LON0) * KX, -(lat - LAT0) * KZ];
export const toLL = (x, z) => [LAT0 - z / KZ, LON0 + x / KX];
