import { Redirect } from 'expo-router';

/** Old date question; the questions now live on one screen. */
export default function DateRedirect() {
  return <Redirect href="/onboarding" />;
}
