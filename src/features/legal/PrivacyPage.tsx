import { Link } from 'react-router';
import { paths } from '../../app/paths';
import { Bullets, ContactLink, LegalPage, LegalSection } from './LegalPage';

/** The privacy policy. Public, so it can be linked from Google's OAuth consent screen. */
export function PrivacyPage() {
  return (
    <LegalPage title="Privacy policy">
      <p>
        Ledger is a personal finance tool that keeps your data in a Google Sheet in your own Google
        Drive, or in a spreadsheet file on your own device if you prefer not to use Google. This
        page explains, in plain language, what Ledger can access, where your data goes and what
        control you have over it.
      </p>

      <LegalSection title="The short version">
        <Bullets>
          <li>
            Ledger has no server or database of its own. It runs entirely in your browser, and your
            data is never processed anywhere other than your device.
          </li>
          <li>
            Using Google is optional. If you do, your data is stored in the Google Sheet you choose
            or create, with a working copy in your browser, and travels directly between your
            browser and Google.
          </li>
          <li>We do not sell, rent or share your data with anyone, and there are no adverts.</li>
          <li>Ledger can only open spreadsheets you pick or create with it, nothing else.</li>
          <li>
            If you open a spreadsheet file from your device instead, it is read in your browser and
            never uploaded anywhere.
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Who runs Ledger">
        <p>
          Ledger is an independent project run by George Sheppard. If you have a question about this
          policy or your data, email <ContactLink />.
        </p>
      </LegalSection>

      <LegalSection title="What Ledger accesses in your Google account">
        <p>
          When you sign in with Google, Ledger asks for one permission:{' '}
          <strong>
            access to the files you use with Ledger (the <code>drive.file</code> permission)
          </strong>
          . This lets Ledger read and write only the spreadsheets you select in Google&rsquo;s file
          chooser or create through Ledger. It cannot see, list or open any other file in your
          Drive, and it does not ask for or store your name, email address, contacts or profile.
        </p>
        <p>
          Within those spreadsheets, Ledger reads and writes your accounts, transactions and
          categories using the Google Sheets and Drive APIs, so it can show your balances and charts
          and save the changes you make.
        </p>
      </LegalSection>

      <LegalSection title="Where your data is kept">
        <Bullets>
          <li>
            <strong>Your Google Sheet.</strong> This is where your financial data is kept. It
            belongs to you, it stays in your Drive, and Google&rsquo;s own privacy policy applies to
            it.
          </li>
          <li>
            <strong>Your browser.</strong> So Ledger is quick and your changes are not lost if the
            connection drops, it keeps a working copy of your connected spreadsheet (your accounts,
            transactions, categories and paychecks, plus any changes not yet saved) in your
            browser&rsquo;s local database (IndexedDB) on this device. Changes are saved back to
            your Google Sheet automatically about once a minute, or straight away when you press
            Save. This copy never leaves your device except to be saved to your own sheet, and it is
            deleted when you exit.
          </li>
          <li>
            <strong>A spreadsheet file on your device.</strong> If you drop or choose an{' '}
            <code>.xlsx</code> or <code>.csv</code> file instead of signing in with Google, Ledger
            reads it in your browser and holds it in memory only. It is not sent to Google, to
            Ledger or to anyone else, and it is not stored in your browser, so closing the tab
            discards it. Changes reach you as a new file when you press Download.
          </li>
          <li>
            <strong>A few small settings.</strong> Ledger also keeps the Google access token for the
            current tab, which is cleared when you close the tab or exit, and the id and name of the
            spreadsheet you connected, so it can offer to reopen it next time, and which way of
            starting you used last (Google, a file, or a blank ledger), so the homepage can mark it
            &ldquo;Last used&rdquo;. That choice is kept after you exit. You can remove everything
            Ledger keeps in your browser at any time by clearing this site&rsquo;s data.
          </li>
          <li>
            <strong>Not on our side.</strong> Ledger does not copy your financial data to any server
            of its own, and we cannot see it.
          </li>
        </Bullets>
      </LegalSection>

      <LegalSection title="Other services involved">
        <Bullets>
          <li>
            <strong>Google</strong> provides sign-in, the file chooser and the Sheets and Drive
            APIs. See the{' '}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noreferrer">
              Google Privacy Policy
            </a>
            .
          </li>
          <li>
            <strong>Cloudflare</strong> hosts the Ledger website. Like any web host, it handles
            standard request information such as your IP address and browser type in order to
            deliver the pages. It never receives your spreadsheet data.
          </li>
        </Bullets>
        <p>
          Ledger does not use analytics, tracking cookies or advertising, and does not share data
          with any other third party.
        </p>
      </LegalSection>

      <LegalSection title="Google API Services User Data Policy">
        <p>
          Ledger&rsquo;s use and transfer of information received from Google APIs adheres to the{' '}
          <a
            href="https://developers.google.com/terms/api-services-user-data-policy"
            target="_blank"
            rel="noreferrer"
          >
            Google API Services User Data Policy
          </a>
          , including the Limited Use requirements. Data from your Google account is used only to
          provide Ledger&rsquo;s features to you. It is not used for advertising, not sold, not
          transferred to others, and not used to train AI or machine learning models. No person
          reads it unless you ask for help and give permission, or the law requires it.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <Bullets>
          <li>
            You can exit Ledger at any time (the Exit button in the sidebar). This deletes the
            working copy and the Google access token from your browser and tells Google to cancel
            the token. Save first if you have unsaved changes.
          </li>
          <li>
            You can remove Ledger&rsquo;s access to your Google account from the{' '}
            <a href="https://myaccount.google.com/connections" target="_blank" rel="noreferrer">
              third-party connections
            </a>{' '}
            page of your Google Account.
          </li>
          <li>
            Your spreadsheet is yours to open, export, share or delete in Google Drive at any time.
            Removing Ledger&rsquo;s access does not delete it.
          </li>
        </Bullets>
        <p>
          Because we do not hold your data, there is nothing for us to export or delete on our side.
          If you think we hold anything about you, email <ContactLink /> and we will help.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Ledger is not intended for children under 13 and does not knowingly serve them.</p>
      </LegalSection>

      <LegalSection title="Changes to this policy">
        <p>
          If this policy changes, the new version will be posted here with a new date at the top. If
          the change affects what Ledger can access, you will be asked to agree again when you next
          sign in. See also the <Link to={paths.terms}>terms of service</Link>.
        </p>
      </LegalSection>
    </LegalPage>
  );
}
