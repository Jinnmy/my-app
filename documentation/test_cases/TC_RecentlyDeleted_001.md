Test Scenario | Recently Deleted | Test Case Description | User manages files in the trash bin
--- | --- | --- | ---
**Pre-condition** | User logged in, files exist in "Recently Deleted" | **Post-condition** | Files restored or permanently removed

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Trash-Restore-001 | Restore Single File | 1. Navigate to "Recently Deleted"<br>2. Right-click file -> "Restore" | | File removed from Trash.<br>File appears in original location.<br>Success notification. | | | |
| TC-Trash-Restore-002 | Restore Multiple Files | 1. Select multiple files<br>2. Click "Restore" in Toolbar | | All selected files restored to original locations. | | | |
| TC-Trash-Delete-001 | Permanent Delete | 1. Right-click file -> "Delete Permanently"<br>2. Confirm warning | | File permanently removed from system.<br>Storage space reclaimed.<br>Cannot be undone. | | | |
| TC-Trash-Empty-001 | Empty Trash | 1. Click "Empty Trash" button<br>2. Confirm warning | | All files in Trash are permanently deleted.<br>Trash list becomes empty. | | | |
| TC-Trash-Info-001 | Verify Retention Info | 1. Hover over file in Trash | | Tooltip/Info shows "Days until permanent deletion" (e.g. 30 days). | | | |
| TC-Trash-Conflict-001 | Restore Name Conflict | 1. Restore file when original location has new file with same name | | System prompts to Rename or Replace.<br>(Or auto-renames depending on config). | | | |
