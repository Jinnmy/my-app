Test Scenario | PDF Viewer | Test Case Description | User views PDF documents
--- | --- | --- | ---
**Pre-condition** | User logged in. Valid PDF files exist in storage. | **Post-condition** | Content is displayed correctly without errors.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-PDF-View-001** | Open PDF Viewer | 1. Double-click a .pdf file | | PDF Viewer opens.<br>Document renders clearly.<br>Page count matches original. | | | |
| **TC-PDF-Nav-001** | PDF Navigation | 1. Open PDF<br>2. Use "Next Page" / "Prev Page" buttons<br>3. Enter page number directly | | Viewer navigates to correct pages.<br>Zoom In/Out works correctly. | | | |
| **TC-PDF-Error-001** | Corrupt PDF Handling | 1. Attempt to open a corrupted .pdf file | | Viewer displays friendly error message: "Error loading PDF" or "Invalid format". | | | |
