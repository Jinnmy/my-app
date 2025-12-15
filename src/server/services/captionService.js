const { execFile } = require('child_process');
const path = require('path');

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
     * Extracts nouns/adjectives or just splits by space and filters common words.
     * @param {string} caption 
     * @returns {string[]}
     */
    static generateTags(caption) {
        if (!caption) return [];

        // Basic stop words to filter out
        const stopWords = new Set(['a', 'an', 'the', 'is', 'are', 'was', 'were', 'of', 'in', 'on', 'at', 'to', 'for', 'with', 'by']);

        // Cleanup and split
        const words = caption.toLowerCase()
            .replace(/[.,\/#!$%\^&\*;:{}=\-_`~()]/g, "")
            .split(/\s+/);

        // Filter
        const tags = words.filter(w => !stopWords.has(w) && w.length > 2);

        // Deduplicate
        return [...new Set(tags)];
    }
}

module.exports = CaptionService;
