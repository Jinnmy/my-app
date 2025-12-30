Test Scenario | Logout | Test Case Description | User logout from system
--- | --- | --- | ---
**Pre-condition** | User is logged in, Valid session active | **Post-condition** | User logged out, Session terminated

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| TC-Logout-001 | Manual Logout | 1. Ensure user is logged in<br><br>2. Locate "Logout" button (Sidebar/Header)<br><br>3. Click "Logout" | Click "Logout" | System terminates session.<br>User redirected to Login page.<br>Local storage/Session storage cleared. | | | |
| TC-Logout-002 | Verify Session Termination | 1. After Logout, click Browser "Back" button<br><br>OR<br><br>2. Manually enter Dashboard URL | Navigate Back / Enter URL | User is NOT redirected to Dashboard.<br>User remains on Login page or sees "Access Denied". | | | |
