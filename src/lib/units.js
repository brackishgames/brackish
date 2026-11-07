// the sim runs in metres and seconds. what you read is what a boater here reads: miles an hour, with the knots beside them
export const MPH_PER_MS = 3600 / 1609.344, KNOTS_PER_MS = 3600 / 1852;   // a statute mile is 1609.344 m; a nautical mile is exactly 1852 m
export const mph = ms => ms * MPH_PER_MS;
export const knots = ms => ms * KNOTS_PER_MS;
