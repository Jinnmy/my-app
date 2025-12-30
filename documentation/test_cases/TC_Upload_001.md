Test Scenario | File Upload | Test Case Description | User uploads files to the system
--- | --- | --- | ---
**Pre-condition** | User logged in, navigated to desired folder | **Post-condition** | File(s) stored in system, metadata recorded

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Upload-001 | Single File Upload | 1. Click "Upload" button<br><br>2. Select single file<br><br>3. Confirm upload | File: `document.pdf` (5MB) | Progress bar shows 100%.<br>File appears in the list.<br>Success notification. | | | |
| TC-Upload-002 | Multiple File Upload | 1. Click "Upload" button<br><br>2. Select multiple files (Ctrl+Click)<br><br>3. Confirm upload | Files: `img1.jpg`, `img2.png`, `doc.txt` | Progress bar for each file.<br>All selected files appear in list.<br>Success notification. | | | |
| TC-Upload-003 | Drag and Drop Upload | 1. Select file from desktop<br><br>2. Drag file into browser drop zone<br><br>3. Release mouse | File: `report.docx` | Drop zone highlighted on hover.<br>File upload starts automatically.<br>File appears in list. | | | |
| TC-Upload-004 | Large File Upload | 1. Upload large file (e.g., >100MB) | File: `huge_video.mp4` (500MB) | Upload completes successfully.<br>(Subject to 10GB User Quota). | | | |
| TC-Upload-005 | Restricted File Type | 1. Upload executable/malicious file | File: `script.exe` | Upload blocked.<br>Error message: "File type not allowed". | | | |
| TC-Upload-006 | Duplicate Filename | 1. Upload file that already exists in folder | File: `existing.txt` | System automatically renames file to `existing (1).txt`.<br>Upload completes successfully. | | | |
