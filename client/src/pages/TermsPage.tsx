import { Link } from 'react-router';
import { ContactLink, LegalLayout, LegalList, LegalSection } from '@/components/legal/LegalLayout';

export default function TermsPage() {
  return (
    <LegalLayout title="Terms of Service" updated="23 November 2026">
      <p>
        These terms apply when you use Ribra, an AI career assistant built and run by Roqeeb Ojetola
        as an independent project. By creating an account or using Ribra, you agree to them.
        Questions? Email <ContactLink />.
      </p>

      <LegalSection title="Using Ribra">
        <LegalList
          items={[
            'You must be at least 16 years old.',
            'Give accurate account details and keep your password safe. You are responsible for activity on your account.',
            'Only upload CVs and other content that you have the right to use.',
          ]}
        />
      </LegalSection>

      <LegalSection title="Things you must not do">
        <LegalList
          items={[
            'Break the law or upload harmful, offensive or malicious content.',
            'Try to break, overload or get around Ribra’s security or usage limits.',
            'Use bots or scripts to access Ribra, or resell it, without permission.',
          ]}
        />
      </LegalSection>

      <LegalSection title="AI-generated results">
        <p>
          Ribra’s scores, suggestions and reports are created by AI. They can be incomplete or
          wrong, and they are guidance only. Always check them yourself before you use them. Ribra
          does not guarantee interviews, job offers or any other outcome.
        </p>
      </LegalSection>

      <LegalSection title="Your content">
        <p>
          Your CVs and the content you add stay yours. You give Ribra permission to store and
          process them only to provide the service to you, as described in our{' '}
          <Link to="/privacy" className="text-brand-300 hover:text-brand-200">
            Privacy Policy
          </Link>
          .
        </p>
      </LegalSection>

      <LegalSection title="Free plan and changes">
        <p>
          Ribra is currently free, with monthly limits on AI features. We may change features or
          limits, or pause or stop the service, at any time. If we plan to shut Ribra down, we will
          try to give you notice so you can save what you need.
        </p>
      </LegalSection>

      <LegalSection title="Closing your account">
        <p>
          You can stop using Ribra at any time and ask us to delete your account by emailing{' '}
          <ContactLink />. We may suspend accounts that break these terms.
        </p>
      </LegalSection>

      <LegalSection title="No warranty and limits of liability">
        <p>
          Ribra is provided “as is”, without warranties of any kind. To the extent the law allows,
          Ribra and its creator are not liable for indirect or consequential losses, or for
          decisions you make based on Ribra’s results. Nothing in these terms limits rights you have
          under consumer protection law that cannot be excluded.
        </p>
      </LegalSection>

      <LegalSection title="Changes to these terms">
        <p>
          We may update these terms. If we do, we will change the date at the top of this page.
          Continuing to use Ribra after a change means you accept the updated terms.
        </p>
      </LegalSection>
    </LegalLayout>
  );
}
