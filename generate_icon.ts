import { GoogleGenAI } from "@google/genai";

async function generateIcon() {
  const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY! });
  const response = await ai.models.generateContent({
    model: 'gemini-3.1-flash-image-preview',
    contents: {
      parts: [
        {
          text: 'A high-quality, professional app icon for a Vietnamese lottery ticket scanner. The icon should feature a stylized lottery ticket with numbers, a scanning line, and festive Lunar New Year elements like red and gold colors, a small lantern, and a clean, modern design. 1024x1024 resolution, centered composition, vibrant colors, flat design style with subtle gradients.',
        },
      ],
    },
    config: {
      imageConfig: {
            aspectRatio: "1:1",
            imageSize: "1K"
        }
    },
  });
  
  for (const part of response.candidates[0].content.parts) {
    if (part.inlineData) {
      console.log(part.inlineData.data);
    }
  }
}

generateIcon();
