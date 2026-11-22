/**
 * Removes personal contact details from text before it is sent to an AI provider.
 * The analysis doesn't need them, and the free Gemini tier may use prompts to improve its models.
 */
export function redactContactDetails(text: string): string {
  return (
    text
      // Email addresses
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      // Links (LinkedIn, GitHub, portfolio...) often contain the person's name
      .replace(/\b(?:https?:\/\/|www\.)\S+/gi, '[link]')
      .replace(/\b(?:linkedin|github)\.com\/\S+/gi, '[link]')
      // Phone numbers: +234 803 123 4567, (555) 123-4567, 08031234567...
      .replace(/(?<![\w])(?:\+?\d[\d\s().-]{7,}\d)(?![\w])/g, (match) =>
        match.replace(/\D/g, '').length >= 8 ? '[phone]' : match,
      )
  );
}
