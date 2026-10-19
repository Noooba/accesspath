import { SiteHeader, SiteFooter } from '@/components/layout/SiteHeader';
import { SavedRoutesLibrary } from '@/components/routing/SavedRoutes';
export const metadata = { title: 'Saved routes' };
export default function SavedRoutesPage() { return <><SiteHeader /><SavedRoutesLibrary /><SiteFooter realWorld /></>; }
