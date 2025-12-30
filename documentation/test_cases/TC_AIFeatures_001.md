Test Scenario | AI Features Analysis | Test Case Description | Validate on-device AI analysis for images and documents
--- | --- | --- | ---
**Pre-condition** | 1. User logged in.<br>2. **AI Features are ENABLED** in Settings.<br>3. AI Models are successfully downloaded. | **Post-condition** | Files have "Caption" and "Tags" metadata populated in the database.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-AI-Image-001** | Caption Image (JPG/PNG) | 1. Upload a clear image (startQueue process)<br>2. Wait for background processing (approx 5-30s)<br>3. Hover over file card OR Check Details | File: "landscape.jpg" | Tooltip/Details displays a generated description (e.g., "A mountain range with sunset").<br>Relevent tags are generated. | | | |
| **TC-AI-Doc-001** | Summarize Word Doc (DOCX) | 1. Upload a .docx file containing text<br>2. Wait for processing | File: "MeetingNotes.docx" | Tooltip/Details displays a text summary of the document content.<br>Tags derived from key topics are added. | | | |
| **TC-AI-Doc-002** | Summarize PDF | 1. Upload a text-based .pdf file<br>2. Wait for processing | File: "contract.pdf" | Tooltip/Details displays a text summary.<br>Tags generated. | | | |
| **TC-AI-Queue-001** | Multiple File Queueing | 1. Upload 5 mixed files (images/docs) rapidly | | System processes files in background (concurrency limit observed).<br>All files eventually have captions/summaries. | | | |
| **TC-AI-Disable-001** | Feature Disabled | 1. Go to Settings -> Disable AI<br>2. Upload an image | File: "test.jpg" | File uploads successfully.<br>NO caption/tags are generated.<br>Metadata "Caption" remains empty. | | | |
