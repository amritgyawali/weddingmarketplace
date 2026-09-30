import { Redirect } from 'expo-router';

/** Old first question; the questions now live on one screen. */
export default function RoleRedirect() {
  return <Redirect href="/onboarding" />;
}
