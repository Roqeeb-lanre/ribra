import { Link } from 'react-router';
import { ContactLink, LegalLayout, LegalList, LegalSection } from '@/components/legal/LegalLayout';

export default function PrivacyPage() {
  return (
    <LegalLayout title="Privacy Policy" updated="23 November 2026">
      <p>
        Ribra is an AI career assistant built and run by Roqeeb Ojetola as an independent project.
        This page explains what information Ribra collects, why, who it is shared with and the
        choices you have. If anything is unclear, email <ContactLink />.
      </p>

      <LegalSection title="What we collect">
        <LegalList
          items={[
            <>
              <strong className="text-white">Account details:</strong> your name and email address.
              If you sign up with a password, we store only a secure hash of it, never the password
              itself.
            </>,
            <>
              <strong className="text-white">Google sign-in:</strong> if you choose “Continue with
              Google”, Google shares your name, email address, profile picture and a Google account
              ID with us. We never see your Google password.
            </>,
            <>
              <strong className="text-white">Your CVs:</strong> files you upload and the text we
              extract from them.
            </>,
            <>
              <strong className="text-white">What you create in Ribra:</strong> CV analyses, job
              descriptions you paste in and the match reports we generate.
            </>,
            <>
              <strong className="text-white">Usage and security data:</strong> how many AI features
              you used this month (for the free plan limits), login sessions, and basic technical
              logs such as IP address and browser type, used to keep the service secure.
            </>,
          ]}
        />
      </LegalSection>

      <LegalSection title="How we use it">
        <LegalList
          items={[
            'To run your account and keep you logged in.',
            'To analyse your CV and compare it with jobs you choose.',
            'To send account emails, such as confirming your email address or resetting your password. We do not send marketing emails.',
            'To enforce fair-use limits, prevent abuse and fix problems.',
          ]}
        />
        <p>We do not sell your data, and we do not use it for advertising.</p>
      </LegalSection>

      <LegalSection title="AI processing">
        <p>
          When you run a CV analysis or job match, the text of your CV (and the job description) is
          sent to Google’s Gemini API to generate the results. Before sending, Ribra removes the
          email addresses, phone numbers and links it finds in your CV.
        </p>
        <p>
          Ribra currently uses Google’s free Gemini API tier. Under Google’s terms for that tier,
          Google may use the content it receives to improve its products, and it may be reviewed by
          people. Please don’t upload information you would not want shared in this way.
        </p>
      </LegalSection>

      <LegalSection title="Who we share it with">
        <p>Only the services Ribra needs to work:</p>
        <LegalList
          items={[
            'MongoDB Atlas (database hosting)',
            'Render (runs the Ribra server)',
            'Vercel (hosts the Ribra website)',
            'Google (Gemini AI processing and, if you use it, Google sign-in)',
            'Brevo (sends account emails)',
          ]}
        />
        <p>We may also disclose information if the law requires it.</p>
      </LegalSection>

      <LegalSection title="Cookies">
        <p>
          Ribra uses one essential cookie to keep you logged in securely. We don’t use advertising
          or tracking cookies. Google’s sign-in button may set its own cookies when you use it.
        </p>
      </LegalSection>

      <LegalSection title="How long we keep it">
        <p>
          We keep your data while your account exists. You can delete any CV in the app at any time,
          which also deletes its analyses and job matches. Email and password-reset links expire
          automatically, and login sessions end after 7 days of inactivity.
        </p>
      </LegalSection>

      <LegalSection title="Your choices">
        <p>
          You can ask to see, correct, export or delete your data, or to close your account, by
          emailing <ContactLink />. We will reply within 30 days. Depending on where you live (for
          example under Nigeria’s NDPA or the EU/UK GDPR), you may have further rights, including
          the right to complain to your data protection authority.
        </p>
      </LegalSection>

      <LegalSection title="Security">
        <p>
          Passwords are hashed, connections use HTTPS, and login tokens are short-lived. No online
          service is perfectly secure, so please use a strong, unique password.
        </p>
      </LegalSection>

      <LegalSection title="Children">
        <p>Ribra is not intended for anyone under 16.</p>
      </LegalSection>

      <LegalSection title="Changes">
        <p>
          If we change this policy, we will update the date at the top of this page. See also our{' '}
          <Link to="/terms" className="text-brand-300 hover:text-brand-200">
            Terms of Service
          </Link>
          .
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
