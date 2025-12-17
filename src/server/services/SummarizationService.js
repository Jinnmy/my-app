const { spawn } = require('child_process');
const path = require('path');

// Configure paths
const PYTHON_PATH = 'python'; // Assumes python is in system PATH
const SCRIPT_PATH = path.join(__dirname, '../../../resources/python/flan_bridge.py');
const MODEL_DIR = path.join(__dirname, '../../../resources/python/flan_t5_onnx');

class SummarizationService {
    /**
     * Generates a summary for the given document path.
     * @param {string} filePath - Absolute path to the .txt or .docx file.
     * @returns {Promise<string>} - The generated summary.
     */
    static generateSummary(filePath) {
        return new Promise((resolve, reject) => {
            console.log(`Generating summary for: ${filePath}...`);

            const pythonProcess = spawn(PYTHON_PATH, [
                SCRIPT_PATH,
                filePath,
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
                // Check if it's a progress log or actual error, for now we just collect it
                // console.debug(`[Python Stderr]: ${data}`); 
            });

            pythonProcess.on('close', (code) => {
                if (code !== 0) {
                    console.error(`Summarization failed with code ${code}. Error: ${errorData}`);
                    // If it failed, we can reject, or resolve null depending on error handling strategy.
                    // For now, rejecting to let caller handle it.
                    reject(new Error(`Process exited with code ${code}: ${errorData}`));
                } else {
                    const summary = outputData.trim();
                    console.log(`Summary generated successfully.`);
                    resolve(summary);
                }
            });

            pythonProcess.on('error', (err) => {
                console.error('Failed to start subprocess.', err);
                reject(err);
            });
        });
    }
}

module.exports = SummarizationService;
