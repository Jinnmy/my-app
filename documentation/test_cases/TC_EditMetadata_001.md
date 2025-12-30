Test Scenario | Edit Metadata | Test Case Description | User edits file/folder name, caption, and tags
--- | --- | --- | ---
**Pre-condition** | User logged in, file/folder exists, user has permission | **Post-condition** | Metadata updated in system

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Metadata-001 | Rename File (Valid) | 1. Right-click file -> "Edit Metadata"<br><br>2. Change Name<br><br>3. Click "Save" | New Name: `Updated_Report` | File renamed successfully.<br>New name appears in list.<br>Extension remains unchanged. | | | |
| TC-Metadata-002 | Edit Caption | 1. Right-click file -> "Edit Metadata"<br><br>2. Enter/Update Caption<br><br>3. Click "Save" | Caption: `Q4 Financial Report` | Caption updated successfully.<br>Tooltip shows new caption. | | | |
| TC-Metadata-003 | Add/Remove Tags | 1. Right-click file -> "Edit Metadata"<br><br>2. Add new tags, remove old ones<br><br>3. Click "Save" | Tags: `+finance`, `-draft` | Tags updated successfully.<br>Search by new tag works. | | | |
| TC-Metadata-004 | Cancel Editing | 1. Right-click file -> "Edit Metadata"<br><br>2. Change fields<br><br>3. Click Cancel (or Esc) | | No changes saved.<br>Dialog closes. | | | |
| TC-Metadata-005 | Empty Name | 1. Open Metadata modal<br><br>2. Clear Name field<br><br>3. Click "Save" | Name: `(empty)` | Save blocked.<br>Error: "Name cannot be empty". | | | |
| TC-Metadata-006 | Duplicate Name | 1. Open Metadata modal<br><br>2. Change name to existing file's name<br><br>3. Click "Save" | Name: `ExistingFile` | Save blocked.<br>Error: "File with this name already exists". | | | |
