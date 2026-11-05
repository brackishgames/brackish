// The time of day, in hours: it moves the sun and moon, decides who hunts and when the gigging lights come out, and is saved.
export const day = { hour: 6.5 };
export const isNight = () => day.hour < 5.8 || day.hour > 19.5;
