import { Link } from 'react-router';
import { paths } from '../../app/paths';
import { Bullets, ContactLink, LegalPage, LegalSection } from './LegalPage';

/** The terms of service. Public, so it can be linked from Google's OAuth consent screen. */
export function TermsPage() {
  return (
    <LegalPage title="Terms of service">
      <p>
        These terms cover your use of Ledger, a free personal finance tool run by George Sheppard
        that stores your data in your own Google Sheet. By signing in to Ledger you agree to them.
        How Ledger handles your data is described in the{' '}
        <Link to={paths.privacy}>privacy policy</Link>.
      </p>

      <LegalSection title="What Ledger is">
        <p>
          Ledger is a website that runs in your browser. It reads and writes a Google Sheet you
          choose so you can record transactions and see summaries of your finances. It has no server
          of its own and does not hold your data.
        </p>
      </LegalSection>

      <LegalSection title="Your Google account and your data">
        <Bullets>
          <li>
            You need a Google account to use Ledger, and you are responsible for keeping it secure.
            Your use of Google&rsquo;s services is also covered by Google&rsquo;s own terms.
          </li>
          <li>
            Your spreadsheet and everything in it belong to you. You give Ledger permission to read
            and change only the spreadsheets you pick or create with it, and only to provide its
            features to you.
          </li>
          <li>
            Ledger edits your spreadsheet when you ask it to, for example when you add a transaction
            or import a CSV file. You can also edit the sheet directly in Google Sheets. We
            recommend keeping your own backups, for example with Google Sheets&rsquo; version
            history.
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Fair use">
        <p>Please don&rsquo;t:</p>
        <Bullets>
          <li>use Ledger for anything unlawful, or with data you have no right to use;</li>
          <li>try to disrupt, overload or break the website or the services it relies on;</li>
          <li>try to access other people&rsquo;s accounts or spreadsheets through Ledger.</li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Not financial advice">
        <p>
          Ledger shows you totals, charts and categories based on the data in your sheet. It is a
          record-keeping tool, not financial, tax or investment advice, and its figures are only as
          accurate as the data you enter or import. Check anything important against your bank
          statements.
        </p>
      </LegalSection>

      <LegalSection title="No warranty">
        <p>
          Ledger is provided free of charge and &ldquo;as is&rdquo;, without any warranty. We work
          to keep it reliable, but we cannot promise it will always be available, error-free, or
          compatible with future changes to Google&rsquo;s services.
        </p>
      </LegalSection>

      <LegalSection title="Liability">
        <p>
          To the extent the law allows, we are not liable for any loss arising from your use of
          Ledger, including lost or incorrect data or decisions made from its figures. Nothing in
          these terms limits any liability that cannot be limited by law.
        </p>
      </LegalSection>

      <LegalSection title="Stopping or changing the service">
        <p>
          You can stop using Ledger at any time by signing out and removing its access from your
          Google Account. Your spreadsheet stays in your Drive. We may change, pause or stop Ledger,
          and may update these terms. Updated terms will be posted here with a new date at the top,
          and continuing to use Ledger after that means you accept them.
        </p>
      </LegalSection>

      <LegalSection title="Contact">
        <p>
          Questions about these terms? Email <ContactLink />.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
