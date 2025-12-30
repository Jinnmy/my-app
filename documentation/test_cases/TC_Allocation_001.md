Test Scenario | Allocate Unmarked Files | Test Case Description | Administrator scans for and assigns orphaned/unmarked files to users
--- | --- | --- | ---
**Pre-condition** | User logged in as **Administrator**. Navigate to "Storage Tools" or "Allocations" page. | **Post-condition** | Files registered in database under target user. User quota updated.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Alloc-Scan-001** | Scan for Files (None) | 1. Click "Scan for Unmarked Files" | | System scans directory.<br>Message displays: "No unmarked files found". | | | |
| **TC-Alloc-Scan-002** | Scan for Files (Success) | 1. Place a simplified file in storage root (bypassing app logic) if possible, or assume existing orphans.<br>2. Click "Scan for Unmarked Files" | | System displays list of detected files (Path, Size).<br>Checkboxes available for selection. | | | |
| **TC-Alloc-Assign-001** | Allocate Single File | 1. Select one file from scan results<br>2. Select Target User from dropdown<br>3. Click "Allocate Selected" | File: "orphan.pdf"<br>User: "John Doe" | Success notification.<br>File removed from Unmarked list.<br>File appears in "John Doe's" file list.<br>John's used storage increases. | | | |
| **TC-Alloc-Assign-002** | Allocate Multiple Files | 1. Select multiple files<br>2. Select Target User<br>3. Click "Allocate Selected" | User: "Jane Smith" | All selected files allocated.<br>Success notification.<br>Files appear in Jane's list. | | | |
| **TC-Alloc-Assign-003** | User Selection Required | 1. Select a file<br>2. Leave User dropdown empty/default<br>3. Click "Allocate Selected" | | Error message: "Please select a target user".<br>No allocation occurs. | | | |
| **TC-Alloc-Refresh-001** | Refresh List | 1. After allocation, click "Scan" again | | The allocated files should NOT appear in the new scan. | | | |
