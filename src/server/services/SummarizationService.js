const { spawn } = require('child_process');
const path = require('path');

const { app } = require('electron');

// Configure paths
let PYTHON_PATH = 'python'; // Assumes python is in system PATH for dev
let SCRIPT_PATH = path.join(__dirname, '../../../resources/python/flan_bridge.py');
let MODEL_DIR = path.join(__dirname, '../../../resources/python/flan_t5_onnx');

if (app.isPackaged) {
    PYTHON_PATH = path.join(process.resourcesPath, 'python_env/python.exe');
    SCRIPT_PATH = path.join(process.resourcesPath, 'python/flan_bridge.py');
    MODEL_DIR = path.join(process.resourcesPath, 'python/flan_t5_onnx');
}

class SummarizationService {
    /**
     * Generates a summary for the given document path.
     * @param {string} filePath - Absolute path to the .txt or .docx file.
     * @returns {Promise<string>} - The generated summary.
     */
    static generateSummary(filePath) {
        return new Promise((resolve, reject) => {
            // Check settings
            let settings = { aiEnabled: false };
            try {
                const settingsPath = path.join(__dirname, '../config/settings.json');
                if (require('fs').existsSync(settingsPath)) {
                    settings = JSON.parse(require('fs').readFileSync(settingsPath, 'utf8'));
                }
            } catch (e) {
                console.error("Failed to read settings in SummarizationService", e);
            }

            if (!settings.aiEnabled) {
                console.log('AI Summarization is disabled in settings.');
                return resolve(null); // Return null so caller knows it's skipped
            }

            console.log(`Generating summary for: ${filePath}...`);

            if (!require('fs').existsSync(PYTHON_PATH) && PYTHON_PATH.includes('python_env')) {
                return reject(new Error('Python environment not found. Please setup AI features first.'));
            }

            // PDF Handling
            let inputPath = filePath;
            let tempPath = null;

            const processSubprocess = () => {
                const pythonProcess = spawn(PYTHON_PATH, [
                    SCRIPT_PATH,
                    inputPath,
                    '--model_dir', MODEL_DIR
                ], {
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8' }
                });

                let outputData = '';
                let errorData = '';

                pythonProcess.stdout.on('data', (data) => {
                    outputData += data.toString();
                });

                pythonProcess.stderr.on('data', (data) => {
                    errorData += data.toString();
                });

                pythonProcess.on('close', (code) => {
                    // Cleanup temp file
                    if (tempPath && require('fs').existsSync(tempPath)) {
                        require('fs').unlinkSync(tempPath);
                    }

                    if (code !== 0) {
                        console.error(`Summarization failed with code ${code}. Error: ${errorData}`);
                        reject(new Error(`Process exited with code ${code}: ${errorData}`));
                    } else {
                        let summary = outputData.trim();
                        if (summary.length > 150) {
                            summary = summary.substring(0, 147) + '...';
                        }
                        console.log(`Summary generated successfully.`);
                        resolve(summary);
                    }
                });

                pythonProcess.on('error', (err) => {
                    // Cleanup temp file
                    if (tempPath && require('fs').existsSync(tempPath)) {
                        require('fs').unlinkSync(tempPath);
                    }
                    console.error('Failed to start subprocess.', err);
                    reject(err);
                });
            };

            const ext = path.extname(filePath).toLowerCase();
            if (ext === '.pdf') {
                console.log('Detected PDF, extracting text...');
                const pdf = require('pdf-parse');
                const fs = require('fs');

                fs.readFile(filePath, (err, dataBuffer) => {
                    if (err) return reject(err);

                    pdf(dataBuffer).then(data => {
                        const text = data.text;
                        // Write to temp file
                        tempPath = filePath + '.temp.txt';
                        fs.writeFile(tempPath, text, (err) => {
                            if (err) return reject(err);
                            inputPath = tempPath;
                            processSubprocess();
                        });
                    }).catch(err => {
                        console.error('PDF parsing error:', err);
                        reject(err);
                    });
                });
            } else {
                processSubprocess();
            }
        });
    }
}

module.exports = SummarizationService;
