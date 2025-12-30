Test Scenario | Move File | Test Case Description | User moves files/folders to different locations
--- | --- | --- | ---
**Pre-condition** | User logged in, file/folder exists, destination folder exists | **Post-condition** | File/folder moved to new location

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Move-001 | Valid Move (Context Menu) | 1. Right-click file -> "Move to"<br>2. Select destination folder<br>3. Click "Move Here" | Destination: `Project B` | File moved successfully.<br>File disappears from current view.<br>File appears in `Project B`. | | | |
| TC-Move-002 | Valid Move (Drag & Drop) | 1. Drag file icon<br>2. Drop onto a folder icon in the grid | Target: `Archive` folder | Move triggered automatically.<br>File moved to `Archive`. | | | |
| TC-Move-003 | Move Locked File | 1. Right-click locked file -> "Move to" | Password: `validPass` | Password prompt appears.<br>After valid password, move dialog opens. | | | |
| TC-Move-004 | Cyclic Move (Folder) | 1. Move Folder A into Folder B (where Folder B is inside Folder A) | | Move blocked.<br>Error: "Cannot move folder into itself". | | | |
| TC-Move-005 | Duplicate Name Collision | 1. Move file to folder that already has file with same name | | Move blocked.<br>Error: "File with same name exists". | | | |
| TC-Move-006 | Move to Root | 1. Use "Move to" dialog<br>2. Select "/ (Root)" | | File moved to top-level directory. | | | |
