Test Scenario | Create Folder | Test Case Description | User creates new folders to organize files
--- | --- | --- | ---
**Pre-condition** | User logged in, navigated to desired parent folder | **Post-condition** | New folder created in the system

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Folder-001 | Create Valid Folder | 1. Click "New Folder" button<br><br>2. Enter valid name<br><br>3. Click OK | Name: `Project A` | Folder created successfully.<br>Folder appears in list.<br>Success notification (optional). | | | |
| TC-Folder-002 | Cancel Creation | 1. Click "New Folder" button<br><br>2. Click Cancel (or Esc) | | No folder created.<br>Dialog closes. | | | |
| TC-Folder-003 | Duplicate Folder Name | 1. Click "New Folder" button<br><br>2. Enter name of existing folder | Name: `Project A` | Creation blocked.<br>Error message: "Folder already exists" (or similar). | | | |
| TC-Folder-004 | Empty Name | 1. Click "New Folder" button<br><br>2. Leave input empty<br><br>3. Click OK | Name: `(empty)` | Input validation fails (blocked).<br>No folder created. | | | |
| TC-Folder-005 | Special Characters | 1. Click "New Folder" button<br><br>2. Enter name with allowed special chars | Name: `Notes_2024` | Folder created successfully. | | | |
| TC-Folder-006 | Invalid Characters | 1. Click "New Folder" button<br><br>2. Enter name with forbidden chars (e.g. `/ \ :`) | Name: `Date/Time` | Creation blocked.<br>Error: "Invalid characters" or OS validation error. | | | |
