Test Scenario | Document Editor | Test Case Description | User edits DOCX/HTML documents including collaboration features
--- | --- | --- | ---
**Pre-condition** | User logged in. User has a valid editable document (DOCX/HTML). | **Post-condition** | Document content updated and saved.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Editor-Open-001** | Open Document | 1. Double-click a valid doc/docx file OR Right-click -> "Open in Editor" | | Editor opens in new window/tab.<br>Content loads correctly.<br>Status shows "Connected". | | | |
| **TC-Editor-Save-001** | Manual Save | 1. Make text changes<br>2. Click "Save" button | Text: "Updated Content" | "Saving..." indicator appears.<br>Success message "All changes saved".<br>File timestamp updated in file list. | | | |
| **TC-Editor-Collab-001** | Real-time Collaboration | 1. Open SAME file in two different browser windows (User A and User B)<br>2. User A types text | User A types: "Hello World" | User B sees "Hello World" appear in near real-time.<br>No conflict errors. | | | |
| **TC-Editor-Format-001** | Rich Text Formatting | 1. Select text<br>2. Apply Bold, Italic, and Color | | Text visual style changes in editor.<br>Changes persist after Save and Reload. | | | |
| **TC-Editor-Access-001** | Read-Only Access | 1. Share file with "View Only" permission to User B<br>2. User B opens file | | Editor loads in Read-Only mode (toolbar disabled or inputs locked).<br>Save button disabled or hidden. | | | |
| **TC-Editor-Close-001** | Close without Save | 1. Make changes<br>2. Click "Close" or Close Tab WITHOUT saving | | (Optional) "Unsaved changes" warning prompt.<br>If confirmed, changes are discarded. | | | |
