import type { ReactNode } from 'react';
import { Link } from 'react-router';
import { paths } from '../../app/paths';
import { Page } from '../../ui/Page';

/** Contact address shown on the privacy policy and terms. */
const CONTACT_EMAIL = 'me@georgesheppard.dev';

/** When the privacy policy or terms last changed. Update it with any change to their wording. */
const LEGAL_LAST_UPDATED = '18 October 2026';

/** Shared frame for the privacy policy and terms: readable width, a way home, and the other page. */
export function LegalPage({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Page
      className="max-w-3xl"
      title={title}
      description={`Last updated ${LEGAL_LAST_UPDATED}`}
      actions={<Link to={paths.home}>Back to Ledger</Link>}
    >
      <div className="flex flex-col gap-8 leading-relaxed">{children}</div>
      <LegalLinks className="border-t border-line pt-6" />
    </Page>
  );
}

export function LegalSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">{title}</h2>
      {children}
    </section>
  );
}

export function Bullets({ children }: { children: ReactNode }) {
  return <ul className="flex list-disc flex-col gap-2 pl-5">{children}</ul>;
}

export function ContactLink() {
  return <a href={`mailto:${CONTACT_EMAIL}`}>{CONTACT_EMAIL}</a>;
}

/** Links to the privacy policy and terms, for footers and under the sign-in button. */
export function LegalLinks({ className }: { className?: string }) {
  return (
    <nav aria-label="Legal" className={className}>
      <ul className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-muted">
        <li>
          <Link to={paths.privacy}>Privacy policy</Link>
        </li>
        <li>
          <Link to={paths.terms}>Terms of service</Link>
        </li>
        <li>
          <ContactLink />
        </li>
      </ul>
    </nav>
  );
}
