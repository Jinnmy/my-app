const { execFile } = require('child_process');
const path = require('path');
const nlp = require('compromise');

// Configure paths
// Ensure python is in path or specify absolute path
const PYTHON_PATH = 'python';
const SCRIPT_PATH = path.join(__dirname, '../../../resources/blip/bridge.py');

class CaptionService {
    /**
     * Generates a caption for the given image path.
     * @param {string} imagePath - Absolute path to the image file
     * @returns {Promise<{caption: string, tags: string[]}>} - The generated caption and tags
     */
    static generateCaption(imagePath) {
        return new Promise((resolve, reject) => {
            // Set PYTHONIOENCODING to utf-8 to avoid encoding issues on Windows
            const options = {
                env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
            };

            console.log(`Generating caption for: ${imagePath}...`);

            execFile(PYTHON_PATH, [SCRIPT_PATH, imagePath], options, (error, stdout, stderr) => {
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
