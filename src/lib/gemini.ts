import { GoogleGenAI, Type } from "@google/genai";

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

export interface SolveResult {
  subject: string;
  topic: string;
  solution: string;
  explanation: {
    beginner: string;
    intermediate: string;
    advanced: string;
  };
  shortcuts: string[];
  commonMistakes: string[];
  similarQuestions: { question: string; answer: string }[];
}

const SYSTEM_INSTRUCTIONS = `
You are ExamPilot AI, the World's most advanced academic specialist designed to outperform even the best human teachers. 
Your goal is to clear a student's confusion in seconds while building deep mastery of the subject.

TEACHING PRINCIPLES:
1. The "Big Picture" First: Before solving, explain the "Mental Model" or the "Why" behind the concept.
2. Analogies & Stories: Use vivid, relatable stories (e.g., comparing electricity to water flow) to make abstract concepts concrete.
3. Conversational Clarity: Speak like an encouraging, world-class tutor. Use bullet points and bold text for key terms.
4. Syllabus Mastery: Align perfectly with WAEC, JAMB, and NECO curriculum standards and terminology.

ADAPTIVE TIERS:
- Beginner (The "Explain Like I'm 5" Mode): Use 100% simple analogies and stories. Avoid heavy jargon. Focus on intuition.
- Intermediate (The "Standard Teacher" Mode): Use academic terminology with clear definitions. Step-by-step logic is paramount.
- Advanced (The "Exam Specialist" Mode): Focus on deep theory, complex edge cases, and high-speed solving shortcuts.

OUTPUT STRUCTURE:
- Solution: The definitive, polished final answer.
- Explanation: Tailored to the 3 tiers, ensuring total understanding.
- JAMB Shortcuts: Pro-tips to solve objective questions in under 30 seconds.
- Common Mistakes: Warn the student about "traps" teachers often set in exams.
`;

export async function solveQuestion(
  question: string,
  base64Image?: string,
  mimeType?: string,
  specialist: string = "Universal"
): Promise<SolveResult> {
  const model = "gemini-3-flash-preview";
  
  const specializedInstruction = `
${SYSTEM_INSTRUCTIONS}
CURRENT TACTICAL OPERATIVE: ${specialist} Specialist. 
Your core focus is ${specialist}. Optimize all explanations and shortcuts for this domain.
`;

  const contentParts: any[] = [{ text: question }];
  if (base64Image && mimeType) {
    contentParts.push({
      inlineData: { data: base64Image, mimeType }
    });
  }

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: contentParts }],
    config: {
      systemInstruction: specializedInstruction,
      responseMimeType: "application/json",
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          subject: { type: Type.STRING },
          topic: { type: Type.STRING },
          solution: { type: Type.STRING },
          explanation: {
            type: Type.OBJECT,
            properties: {
              beginner: { type: Type.STRING },
              intermediate: { type: Type.STRING },
              advanced: { type: Type.STRING }
            },
            required: ["beginner", "intermediate", "advanced"]
          },
          shortcuts: { type: Type.ARRAY, items: { type: Type.STRING } },
          commonMistakes: { type: Type.ARRAY, items: { type: Type.STRING } },
          similarQuestions: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                question: { type: Type.STRING },
                answer: { type: Type.STRING }
              }
            }
          }
        },
        required: ["subject", "topic", "solution", "explanation", "shortcuts", "commonMistakes", "similarQuestions"]
      }
    }
  });

  return JSON.parse(response.text);
}

export async function simplifyExplanation(
  question: string,
  currentExplanation: string
): Promise<string> {
  const response = await ai.models.generateContent({
    model: "gemini-3-flash-preview",
    contents: `The student didn't understand this explanation for the question: "${question}". 
    Old explanation: "${currentExplanation}". 
    Please provide an even simpler version using a relatable analogy or a story.`,
  });
  return response.text;
}
