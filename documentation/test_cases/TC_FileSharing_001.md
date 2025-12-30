Test Scenario | File Sharing | Test Case Description | User shares files with other users or via public links
--- | --- | --- | ---
**Pre-condition** | User logged in, file exists, user is owner | **Post-condition** | Share records created, notifications sent (optional)

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **Email Sharing** ||||||||
| TC-Share-001 | Share by Email (Valid) | 1. Right-click file -> "Share"<br>2. Select "User" tab<br>3. Enter valid email<br>4. Click "Share" | Email: `colleague@example.com` | User added to shared list.<br>Success notification. | | | |
| TC-Share-002 | Share by Email (Invalid) | 1. Right-click file -> "Share"<br>2. Enter non-existent email<br>3. Click "Share" | Email: `fake@invalid` | Share blocked.<br>Error: "User not found". | | | |
| TC-Share-003 | Revoke User Access | 1. Open Share modal<br>2. Find user in list<br>3. Click "Remove" | | User removed from list.<br>Access revoked immediately. | | | |
| **Public Link** ||||||||
| TC-Share-004 | Generate Public Link | 1. Right-click file -> "Share"<br>2. Select "Public Link" tab<br>3. Click "Generate Link" | Defaults (1 Hour, Unlimited uses) | Link generated and displayed.<br>"Copy" button active. | | | |
| TC-Share-005 | Link Options (Expiry) | 1. Select "Public Link" tab<br>2. Set Expiry to "7 Days"<br>3. Click "Generate Link" | Expiry: 7 Days | Link generated with 7 day validity. | | | |
| TC-Share-006 | Link Options (Max Uses) | 1. Select "Public Link" tab<br>2. Set Max Uses to "1 Time"<br>3. Click "Generate Link" | Max Uses: 1 | Link generated.<br>Link becomes invalid after 1 download. | | | |
