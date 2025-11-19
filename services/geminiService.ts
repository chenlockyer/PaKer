import { GoogleGenAI } from "@google/genai";

const getClient = () => {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
        console.warn("API_KEY is missing");
        return null;
    }
    return new GoogleGenAI({ apiKey });
};

export const getBuildingTip = async (): Promise<string> => {
    const ai = getClient();
    if (!ai) return "Please set your API Key to receive AI tips.";

    try {
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: "Give me a very short, one-sentence physics tip for building a house of cards. Be witty.",
            config: {
                thinkingConfig: { thinkingBudget: 0 } 
            }
        });
        return response.text || "Balance is key!";
    } catch (error) {
        console.error("Error fetching tip:", error);
        return "Keep your hand steady and the friction high.";
    }
};
