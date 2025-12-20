const { execFile } = require('child_process');
const path = require('path');
const nlp = require('compromise');

const { app } = require('electron');

// Configure paths
let PYTHON_PATH = 'python';
let SCRIPT_PATH = path.join(__dirname, '../../../resources/blip/bridge.py');

if (app.isPackaged) {
    PYTHON_PATH = path.join(process.resourcesPath, 'python_env/python.exe');
    SCRIPT_PATH = path.join(process.resourcesPath, 'blip/bridge.py');
}

class CaptionService {
    /**
     * Generates a caption for the given image path.
     * @param {string} imagePath - Absolute path to the image file
     * @returns {Promise<{caption: string, tags: string[]}>} - The generated caption and tags
     */
    static generateCaption(imagePath) {
        return new Promise(async (resolve, reject) => {
            // Check settings
            let settings = { aiEnabled: false };
            try {
                const settingsPath = path.join(__dirname, '../config/settings.json');
                if (require('fs').existsSync(settingsPath)) {
                    settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf8'));
                }
            } catch (e) {
                console.error("Failed to read settings in captionService", e);
            }

            if (!settings.aiEnabled) {
                console.log('AI Captioning is disabled in settings.');
                return resolve({ caption: null, tags: [] });
            }

            // Set PYTHONIOENCODING to utf-8 to avoid encoding issues on Windows
            const options = {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            };

            let inferencePath = imagePath;
            let tempPath = null;
            const fs = require('fs');

            // HEIC Handling
            if (path.extname(imagePath).toLowerCase() === '.heic') {
                try {
                    console.log('Detected HEIC file, converting for captioning...');
                    const heicConvert = require('heic-convert');
                    const inputBuffer = await fs.promises.readFile(imagePath);
                    const outputBuffer = await heicConvert({
                        buffer: inputBuffer,
                        format: 'JPEG',
                        quality: 0.8
                    });

                    // Create temp file
                    const uniqueId = Math.random().toString(36).substring(7);
                    tempPath = path.join(path.dirname(imagePath), `temp_caption_${uniqueId}.jpg`);
                    await fs.promises.writeFile(tempPath, outputBuffer);
                    inferencePath = tempPath;
                } catch (err) {
                    console.error('Failed to convert HEIC for captioning:', err);
                    return resolve({ caption: null, tags: [] });
                }
            }

            console.log(`Generating caption for: ${inferencePath}...`);

            if (!fs.existsSync(PYTHON_PATH) && PYTHON_PATH.includes('python_env')) {
                console.warn('Python environment not found. Skipping caption generation.');
                if (tempPath) fs.unlink(tempPath, () => { });
                return resolve({ caption: null, tags: [] });
            }

            execFile(PYTHON_PATH, [SCRIPT_PATH, inferencePath], options, (error, stdout, stderr) => {
                // Cleanup temp file
                if (tempPath) {
                    fs.unlink(tempPath, (err) => {
                        if (err) console.error('Failed to clean up temp file:', err);
                    });
                }

                if (error) {
                    console.error('Inference Error:', stderr);
                    // Don't fail the upload if captioning fails, just resolve null
                    console.warn('Captioning failed, proceeding without caption.');
                    return resolve({ caption: null, tags: [] });
                }

                // The script prints ONLY the caption to stdout (as per user instruction)
                const caption = stdout.trim();
                const tags = CaptionService.generateTags(caption);

                console.log(`Caption: "${caption}"`);

                resolve({ caption, tags });
            });
        });
    }

    /**
     * Simple tag generation from caption.
     * Extracts nouns/adjectives using NLP to avoid noise.
     * @param {string} caption 
     * @returns {string[]}
     */
    static generateTags(caption) {
        if (!caption) return [];

        const doc = nlp(caption);

        // Extract nouns & adjectives only
        const nouns = doc.nouns().out('array');
        const adjectives = doc.adjectives().out('array');

        const tags = [...nouns, ...adjectives]
            .map(w => w.toLowerCase())
            .filter(w => w.length > 2);

        return [...new Set(tags)].slice(0, 5);
    }
}

module.exports = CaptionService;
