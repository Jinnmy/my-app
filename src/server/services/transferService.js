const fs = require('fs');
const path = require('path');
const TransferModel = require('../models/transferModel');
const FileModel = require('../models/fileModel');
const UserModel = require('../models/userModel');
const crypto = require('crypto');

const CONCURRENCY_LIMIT = 2; // Simultaneous transfers

class TransferService {
    constructor() {
        this.isProcessing = false;
        this.intervalId = null;
        this.isShuttingDown = false;
    }

    start() {
        console.log('TransferService started.');

        // Reset any stuck 'processing' transfers from previous run
        TransferModel.resetProcessing((err, changes) => {
            if (err) console.error('Failed to reset processing transfers:', err);
            else if (changes > 0) console.log(`Reset ${changes} stuck transfers to pending.`);

            this.processQueue();
            this.processQueue();
            // Poll regularly in case of stuck jobs or new ones
            this.intervalId = setInterval(() => this.processQueue(), 5000);
        });
    }

    stop() {
        console.log('Stopping TransferService...');
        this.isShuttingDown = true;
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
        }
    }

    async processQueue() {
        if (this.isProcessing || this.isShuttingDown) return;
        this.isProcessing = true;

        try {
            TransferModel.countProcessing((err, count) => {
                if (err) {
                    console.error('Error counting processing transfers:', err);
                    this.isProcessing = false;
                    return;
                }

                if (count >= CONCURRENCY_LIMIT) {
                    // Queue full
                    this.isProcessing = false;
                    return;
                }

                // Get next pending job
                TransferModel.findPending((err, transfers) => {
                    if (err || !transfers || transfers.length === 0) {
                        this.isProcessing = false;
                        return;
                    }

                    const slotsAvailable = CONCURRENCY_LIMIT - count;
                    const jobsToStart = transfers.slice(0, slotsAvailable);

                    jobsToStart.forEach(transfer => this.executeTransfer(transfer));

                    this.isProcessing = false;
                });
            });
        } catch (e) {
            console.error('Transfer loop error:', e);
            this.isProcessing = false;
        }
    }

    executeTransfer(transfer) {
        // Mark as processing immediately
        TransferModel.updateStatus(transfer.id, 'processing', null, (err) => {
            if (err) return console.error(`Failed to mark transfer ${transfer.id} as processing`);

            if (transfer.type === 'upload') {
                this.handleUpload(transfer);
            } else if (transfer.type === 'download') {
                this.handleDownload(transfer);
            }
        });
    }

    handleUpload(transfer) {
        const { source, destination, metadata, user_id, id } = transfer;

        // Check if source file exists
        if (!fs.existsSync(source)) {
            return TransferModel.updateStatus(id, 'failed', 'Source file not found (maybe deleted?)');
        }

        // Ensure destination directory exists
        const destDir = path.dirname(destination);
        if (!fs.existsSync(destDir)) {
            fs.mkdirSync(destDir, { recursive: true });
        }

        const finalizeUpload = (finalPath, captionData = {}) => {
            FileModel.create({
                name: metadata.originalname,
                path: finalPath,
                type: 'file',
                size: metadata.size,
                parent_id: metadata.parentId,
                user_id: user_id,
                caption: captionData.caption || null,
                tags: captionData.tags || [],
                is_encrypted: metadata.isEncrypted ? 1 : 0
            }, (err, newFile) => {
                if (err) {
                    return TransferModel.updateStatus(id, 'failed', 'File saved but DB update failed: ' + err.message);
                }

                // Update User Storage
                UserModel.updateStorage(user_id, metadata.size, (err) => {
                    if (err) console.error('Failed to update storage usage on upload:', err);
                });

                // Queue for background processing (Captioning / Summarization) - ONLY IF NOT ENCRYPTED
                if (!metadata.isEncrypted) {
                    const CaptionQueue = require('../services/captionQueue');
                    CaptionQueue.add({
                        id: newFile.id,
                        path: finalPath,
                        name: metadata.originalname
                    });
                }

                TransferModel.updateStatus(id, 'completed');
            });
        };

        if (metadata.isEncrypted) {
            // ENCRYPTION FLOW
            if (!metadata.vaultKey) {
                return TransferModel.updateStatus(id, 'failed', 'Missing vault key for encrypted transfer');
            }

            try {
                const key = Buffer.from(metadata.vaultKey, 'hex');
                const iv = crypto.randomBytes(16);
                const cipher = crypto.createCipheriv('aes-256-ctr', key, iv);

                const input = fs.createReadStream(source);
                const output = fs.createWriteStream(destination);

                // Write IV first
                output.write(iv);

                input.pipe(cipher).pipe(output);

                output.on('finish', () => {
                    // Cleanup
                    fs.unlink(source, () => { });
                    finalizeUpload(destination);
                });

                output.on('error', (err) => {
                    console.error('Encryption write error:', err);
                    TransferModel.updateStatus(id, 'failed', 'Encryption failed');
                });

            } catch (e) {
                console.error('Encryption error:', e);
                return TransferModel.updateStatus(id, 'failed', 'Encryption setup failed');
            }

        } else {
            // STANDARD FLOW
            // Move file (Copy then Delete to handle cross-device EXDEV errors)
            fs.copyFile(source, destination, (err) => {
                if (err) {
                    console.error(`Error copying file for transfer ${id}:`, err);
                    return TransferModel.updateStatus(id, 'failed', err.message);
                }

                // Copy successful, now delete source
                fs.unlink(source, (unlinkErr) => {
                    if (unlinkErr) console.warn(`Failed to delete temp file ${source}:`, unlinkErr);
                });

                finalizeUpload(destination);
            });
        }
    }

    handleDownload(transfer) {
        // For downloads, the "processing" might just mean we are ready to stream.
        // But actually, the browser requests the stream. 
        // If we want to limit concurrency, the browser request should WAIT until it gets a slot.
        // This is tricky with a persistent background service vs HTTP request-response.

        // A simpler approach for V1 Download Queue:
        // The user requests a download. Controller checks TransferService.
        // If slots are open, it allows the stream effectively immediately and tracks it as an "active download" in memory or DB.
        // If slots are full, it returns 429 "Busy".
        // SO for now, the "Queue" for downloads might just be a tracker, not an async processor that pushes files to the user later.

        // However, sticking to the `status` model:
        // If we really want to queue downloads, we'd need to generate a temp link or notify user "Download Ready".
        // Let's implement the "Tracker" approach. The `executeTransfer` here is just a stub because
        // control is actually in the HTTP handler for the stream.

        // We might simply mark it completed after a timeout if we can't track stream end easily here,
        // OR the controller calls `complete` when the stream ends.

        // Let's assume the Controller handles the stream and just uses TransferModel to 'reserve' a slot.
        // So this service finds a 'pending' download, sees if it can start?
        // No, HTTP doesn't work that way. The client initiates.

        // Revising Download Plan:
        // Browser -> Request Download -> Controller checks active count -> 
        //    If OK -> Create Transfer(Active) -> Stream -> On Finish -> Update Transfer(Completed).
        //    If Busy -> Return Error "Queue Full".

        // So `handleDownload` in this background worker might actually handle "cleaning up" stuck downloads?

        // For this iteration, let's focus primarily on Upload Queue which is the heavy lifting.
        // We'll mark download as completed immediately here if it somehow got into the queue to clear it out.
        TransferModel.updateStatus(transfer.id, 'completed', 'Download tracking handled by controller');
    }
}

module.exports = new TransferService();
