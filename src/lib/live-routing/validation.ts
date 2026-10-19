import { z } from 'zod';

export const latLon = z.object({ lat: z.number().finite().min(-90).max(90), lon: z.number().finite().min(-180).max(180) }).strict();
export const placeSearchInput = z.object({ query: z.string().trim().min(3).max(160).refine((value) => !/[\u0000-\u001f\u007f]/.test(value), 'Use a plain-text place name.') }).strict();
export const liveRouteInput = z.object({ start: latLon, end: latLon }).strict().refine(({ start, end }) => start.lat !== end.lat || start.lon !== end.lon, 'Choose two different locations.');
export const lonLatTuple = z.tuple([z.number().finite().min(-180).max(180), z.number().finite().min(-90).max(90)]);
