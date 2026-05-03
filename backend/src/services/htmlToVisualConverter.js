/**
 * Konversi HTML email template ke format Listmonk Visual Template (body_source JSON)
 * menggunakan OpenAI untuk analisis semantik.
 */

const OpenAI = require('openai');

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const VISUAL_CONVERTER_PROMPT = `You are an expert at converting HTML email templates into Listmonk visual template JSON format.

Given an HTML email template, convert it into a Listmonk visual template body_source JSON object.

The JSON structure must follow this EXACT format:

{
  "root": {
    "type": "EmailLayout",
    "data": {
      "backdropColor": "#F5F5F5",
      "canvasColor": "#FFFFFF",
      "textColor": "#262626",
      "fontFamily": "MODERN_SANS",
      "childrenIds": ["block-1", "block-2", ...]
    }
  },
  "block-1": { ... },
  "block-2": { ... }
}

Available block types and their data structure:

1. **Heading** - For titles and headings
{
  "type": "Heading",
  "data": {
    "props": { "text": "Hello World", "level": "h1" },
    "style": {
      "color": "#000000",
      "backgroundColor": null,
      "fontWeight": "bold",
      "textAlign": "center",
      "padding": { "top": 16, "bottom": 8, "right": 24, "left": 24 }
    }
  }
}

2. **Text** - For paragraphs, descriptions, addresses, any text content. Supports markdown.
{
  "type": "Text",
  "data": {
    "props": { "markdown": true, "text": "This is **bold** and [a link](https://example.com)" },
    "style": {
      "color": null,
      "backgroundColor": null,
      "fontSize": 14,
      "fontWeight": "normal",
      "textAlign": "left",
      "padding": { "top": 8, "bottom": 8, "right": 24, "left": 24 }
    }
  }
}

3. **Image** - For images, logos, banners, icons
{
  "type": "Image",
  "data": {
    "props": {
      "url": "https://example.com/image.png",
      "alt": "Description",
      "linkHref": null,
      "contentAlignment": "middle"
    },
    "style": {
      "backgroundColor": null,
      "padding": { "top": 16, "bottom": 16, "right": 0, "left": 0 },
      "textAlign": "center"
    }
  }
}

4. **Button** - For CTA buttons
{
  "type": "Button",
  "data": {
    "props": {
      "text": "Click Here",
      "url": "https://example.com",
      "buttonBackgroundColor": "#0055d4",
      "textColor": "#FFFFFF"
    },
    "style": {
      "padding": { "top": 16, "bottom": 16, "right": 24, "left": 24 },
      "textAlign": "center"
    }
  }
}

5. **Divider** - For horizontal lines/separators between sections
{
  "type": "Divider",
  "data": {
    "props": { "lineColor": "#CCCCCC" },
    "style": { "padding": { "top": 16, "bottom": 16, "right": 0, "left": 0 } }
  }
}

6. **Spacer** - For empty space
{
  "type": "Spacer",
  "data": {
    "props": { "height": 16 },
    "style": {}
  }
}

CRITICAL RULES:
1. Generate unique block IDs like "block-1", "block-2", etc.
2. The "childrenIds" array in root MUST list ALL block IDs in order.
3. Preserve ALL text content from the HTML. Do NOT skip any section.
4. Preserve ALL images with their original URLs.
5. For social media icon rows: create ONE Text block with markdown containing all icon images as inline markdown images: ![alt](url)
6. Group related text into single Text blocks when they belong to the same logical section.
7. Preserve Listmonk template variables exactly: {{ .Subscriber.FirstName }}, {{ .Subscriber.Email }}, {{ UnsubscribeURL }}, {{ MessageURL }}, {{ TrackView }}
8. For links in text, use markdown: [link text](url)
9. For "View in browser" and "Unsubscribe" links in footer, use this format:
   <a href="{{ UnsubscribeURL }}" style="color: #888;">Unsubscribe</a>&nbsp;&nbsp;<a href="{{ MessageURL }}" style="color: #888;">View in browser</a>
10. Extract background colors from sections and apply to block styles.
11. For colored section backgrounds, set backgroundColor on the block style.
12. Multiple small images in a row (like social icons) should be combined into ONE Image or Text block, NOT separate blocks.
13. Preserve button colors, text colors, and link URLs.
14. The LAST block should be a footer Text block with unsubscribe/message links.

Return ONLY the valid JSON object. No explanation, no markdown, no code blocks.`;

/**
 * Konversi HTML email ke Listmonk visual template body_source JSON menggunakan AI.
 * @param {string} html - raw HTML email template
 * @returns {Promise<{ bodySource: string }>}
 */
const htmlToVisualTemplate = async (html) => {
  const response = await openai.chat.completions.create({
    model: 'gpt-5.4',
    max_completion_tokens: 8192,
    messages: [
      { role: 'system', content: VISUAL_CONVERTER_PROMPT },
      {
        role: 'user',
        content: `Convert this HTML email template to Listmonk visual template body_source JSON:\n\n${html}`,
      },
    ],
  });

  const content = response.choices[0]?.message?.content || '';

  // Parse JSON — strip any accidental markdown wrapping
  const jsonMatch = content.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    throw new Error('AI gagal menghasilkan visual template JSON.');
  }

  const bodySource = JSON.parse(jsonMatch[0]);

  // Validate structure
  if (!bodySource.root || !bodySource.root.data?.childrenIds) {
    throw new Error('Visual template JSON tidak memiliki struktur root yang valid.');
  }

  return {
    bodySource: JSON.stringify(bodySource),
  };
};

module.exports = { htmlToVisualTemplate };
