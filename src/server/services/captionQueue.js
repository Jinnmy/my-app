const CaptionService = require('./captionService');
const SummarizationService = require('./SummarizationService');
const FileModel = require('../models/fileModel');
const path = require('path');

const CONCURRENCY_LIMIT = 3;

class CaptionQueue {
    constructor() {
        this.queue = [];
        this.activeJobs = 0;
    }

    /**
     * Add a file to the captioning queue
     * @param {object} file - The file object (must contain id, path, name)
     */
    add(file) {
        this.queue.push(file);
        this.processNext();
    }

    processNext() {
        if (this.activeJobs >= CONCURRENCY_LIMIT || this.queue.length === 0) {
            return;
        }

        const file = this.queue.shift();
        this.activeJobs++;

        this.processFile(file).finally(() => {
            this.activeJobs--;
            this.processNext();
        });
    }

    async processFile(file) {
        try {
            console.log(`[CaptionQueue] Starting processing for ${file.name} (ID: ${file.id})`);

            const ext = path.extname(file.name).toLowerCase();
            const imageExts = ['.jpg', '.jpeg', '.png', '.webp', '.bmp', '.heic'];

            let result = { caption: null, tags: [] };

            if (imageExts.includes(ext)) {
                result = await CaptionService.generateCaption(file.path);
            } else if (['.txt', '.docx'].includes(ext)) {
                const summary = await SummarizationService.generateSummary(file.path);
                const tags = CaptionService.generateTags(summary);
                result = { caption: summary, tags };
            }

            if (result.caption) {
                // Update DB with results
                // We use updateDetails but need to preserve existing data, 
                // essentially we are just patching caption and tags.
                // Since updateDetails requires all fields, better to create a specific update method 
                // OR re-fetch. Re-fetching is safer.

                FileModel.findById(file.id, (err, currentFile) => {
                    if (err || !currentFile) {
                        console.error(`[CaptionQueue] Keep-alive check failed for ${file.id}`, err);
                        return;
                    }

                    FileModel.updateDetails(
                        currentFile.id,
                        currentFile.name,
                        currentFile.path,
                        currentFile.type,
                        currentFile.path, // oldPath logic same as new if not moving
                        result.caption,
                        result.tags,
                        (err) => {
                            if (err) console.error(`[CaptionQueue] Failed to save caption for ${file.id}:`, err);
                            else console.log(`[CaptionQueue] Processed ${file.name}`);
                        }
                    );
                });
            } else {
                console.log(`[CaptionQueue] No caption generated for ${file.name}`);
            }

        } catch (error) {
            console.error(`[CaptionQueue] Error processing ${file.name}:`, error);
        }
    }
}

module.exports = new CaptionQueue();
