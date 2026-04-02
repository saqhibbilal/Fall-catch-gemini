import { NextRequest, NextResponse } from "next/server";
import { GoogleGenerativeAI } from "@google/generative-ai";
import { GoogleAIFileManager } from "@google/generative-ai/server";
import { writeFile, unlink } from "fs/promises";
import { join } from "path";
import os from "os";

export async function POST(request: NextRequest) {
    let tempFilePath: string | null = null;
    let geminiFileName: string | null = null;
    let fileManager: GoogleAIFileManager | null = null;

    try {
        const apiKey = process.env.GEMINI_API_KEY;
        if (!apiKey) {
            throw new Error("GEMINI_API_KEY is not configured on the server.");
        }

        const formData = await request.formData();
        const file = formData.get("video") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No video file provided" }, { status: 400 });
        }

        // Convert Next.js File to Buffer
        const bytes = await file.arrayBuffer();
        const buffer = Buffer.from(bytes);

        // Save to OS temp directory temporarily (required by GoogleAIFileManager)
        const tmpdir = os.tmpdir();
        // Use random suffix to prevent collisions
        const randomSuffix = Math.random().toString(36).substring(7);
        // Sanitize file name just in case
        const safeName = file.name.replace(/[^a-zA-Z0-9.\-_]/g, '_');
        tempFilePath = join(tmpdir, `upload-${Date.now()}-${randomSuffix}-${safeName}`);

        await writeFile(tempFilePath, buffer);

        // Initialize Gemini Clients
        fileManager = new GoogleAIFileManager(apiKey);
        const genAI = new GoogleGenerativeAI(apiKey);

        // 1. Upload Video to Gemini
        const uploadResult = await fileManager.uploadFile(tempFilePath, {
            mimeType: file.type,
            displayName: file.name,
        });

        geminiFileName = uploadResult.file.name;

        // 2. Poll the state of the video. 
        // Gemini may need a bit of time to process a video upload before generating content.
        let geminiFile = await fileManager.getFile(geminiFileName);
        let attempts = 0;
        while (geminiFile.state === "PROCESSING" && attempts < 30) {
            await new Promise((resolve) => setTimeout(resolve, 2000));
            geminiFile = await fileManager.getFile(geminiFileName);
            attempts++;
        }

        if (geminiFile.state === "FAILED") {
            throw new Error("Video processing failed on Google Gemini servers.");
        }

        if (geminiFile.state === "PROCESSING") {
            throw new Error("Video processing timed out.");
        }

        // 3. Prompt the model
        // Using flash model as it excels at quick multimodal tasks
        const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
        const prompt = `Analyze this video carefully. Determine if a person has accidentally fallen down in the video.
Return exclusively a JSON object with nothing else, adhering to this structure exactly:
{
  "fallDetected": boolean,
  "confidence": number, // an integer from 0 to 100
  "explanation": "string, a brief explanation of the reasoning"
}
Ensure your response is ONLY valid JSON. Do not include markdown code block syntax like \`\`\`json.`;

        const result = await model.generateContent([
            {
                fileData: {
                    mimeType: uploadResult.file.mimeType,
                    fileUri: uploadResult.file.uri,
                }
            },
            { text: prompt },
        ]);

        const responseText = result.response.text();
        const cleanedText = responseText.replace(/```json/gi, "").replace(/```/g, "").trim();

        const jsonResult = JSON.parse(cleanedText);

        return NextResponse.json(jsonResult);
    } catch (error: any) {
        console.error("API Error: ", error);
        return NextResponse.json({ error: error.message || "An unexpected error occurred" }, { status: 500 });
    } finally {
        // 4. Clean up operations (Execute even if throws an error)
        if (fileManager && geminiFileName) {
            try {
                await fileManager.deleteFile(geminiFileName);
                console.log(`Successfully deleted ${geminiFileName} from Gemini servers.`);
            } catch (e) {
                console.error("Failed to delete Gemini file:", e);
            }
        }

        if (tempFilePath) {
            try {
                await unlink(tempFilePath);
            } catch (e) {
                console.error("Failed to delete temporary local file:", e);
            }
        }
    }
}
