/**
 * Template loader utility for fetching Word document templates
 */

export async function loadTemplate(templatePath: string): Promise<ArrayBuffer> {
  try {
    const response = await fetch(templatePath);
    if (!response.ok) {
      throw new Error(`Failed to load template: ${response.statusText}`);
    }
    return await response.arrayBuffer();
  } catch (error) {
    throw new Error(`Template loading failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
  }
}

/**
 * Default template paths
 */
export const TEMPLATE_PATHS = {
  QUOTE: '/templates/quote-template.docx',
  CONTRACT: '/templates/contract-template.docx',
  NEW_CONTRACT: '/templates/New-Contract-Template.docx',
} as const;

