Test Scenario | Move to Trash (Soft Delete) | Test Case Description | User moves files/folders to the trash bin
--- | --- | --- | ---
**Pre-condition** | User logged in, file/folder exists | **Post-condition** | File moved to "Recently Deleted"

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Trash-001 | Delete Single File | 1. Right-click file -> "Delete"<br>2. Confirm dialog (if enabled) | | File removed from current view.<br>File appears in "Recently Deleted".<br>Storage usage remains (until permanent delete). | | | |
| TC-Trash-002 | Delete Folder | 1. Right-click folder -> "Delete"<br>2. Confirm dialog | | Folder and all contents moved to Trash.<br>Removed from current view. | | | |
| TC-Trash-003 | Delete Locked File | 1. Right-click locked file -> "Delete" | | Action blocked.<br>Error: "File is locked".<br>(User must unlock first). | | | |
| TC-Trash-004 | Delete Selection | 1. Select multiple files<br>2. Click Toolbar Delete button | | All selected files moved to Trash. | | | |
| TC-Trash-005 | Verify Trash Content | 1. Navigate to "Recently Deleted" tab | | Deleted files listed with "Days remaining" or deletion date. | | | |
