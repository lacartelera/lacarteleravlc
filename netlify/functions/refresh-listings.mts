import { getListings } from './listings.mts';
export default async()=>{const data=await getListings(true);if(data.sources.every(source=>!source.available))throw new Error('No official source could be refreshed');};
export const config={schedule:'*/15 * * * *'};
