import { redirect } from 'next/navigation';
import { getProfile } from '@/lib/db/repository';
import { resumePath } from '@/lib/onboarding';

export const dynamic = 'force-dynamic';

/**
 * `/welcome` is an address, not a screen: it sends you to wherever the sequence
 * actually stopped. Sign-up redirects here, and so does anyone who bookmarked
 * the old single-page wizard.
 */
export default async function WelcomeIndexPage({
  searchParams,
}: {
  searchParams: Promise<{ created?: string }>;
}) {
  // Sign-up sets `created`, and it has to survive this hop or the confirmation
  // is lost on the redirect that follows verifying a code.
  const { created } = await searchParams;
  const path = resumePath(await getProfile());
  redirect(created ? `${path}?created=1` : path);
}
