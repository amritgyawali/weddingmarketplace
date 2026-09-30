import { Redirect } from 'expo-router';

/** Old city question; the questions now live on one screen. */
export default function CityRedirect() {
  return <Redirect href="/onboarding" />;
}
