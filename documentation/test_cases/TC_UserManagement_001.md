Test Scenario | User Management | Test Case Description | Administrator manages user accounts (Create, Edit, Delete, Allocations)
--- | --- | --- | ---
**Pre-condition** | User logged in as **Administrator**. Navigate to "Users" page. | **Post-condition** | User list updated. Database reflects changes.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-User-Create-001** | Create New User (Valid) | 1. Click "Add User" button<br>2. Fill in details<br>3. Set Role and Storage Limit<br>4. Click "Create" | Name: "John Doe"<br>Email: "john@example.com"<br>Pass: "Welcome123"<br>Role: "User"<br>Storage: 5GB | User created securely.<br>Success notification displayed.<br>New user appears in the User List. | | | |
| **TC-User-Create-002** | Duplicate Email Validation | 1. Click "Add User"<br>2. Enter email of EXISTING user<br>3. Click "Create" | Email: [ExistingEmail] | Error message: "Email already in use".<br>User NOT created. | | | |
| **TC-User-Create-003** | Invalid Input Validation | 1. Click "Add User"<br>2. Enter invalid email format OR weak password<br>3. Click "Create" | Email: "john.com"<br>Pass: "123" | Validation errors displayed on respective fields.<br>Form not submitted. | | | |
| **TC-User-Edit-001** | Edit User Details | 1. Find user in list<br>2. Click "Edit" (Pencil icon)<br>3. Change Username or Role<br>4. Click "Save" | Name: "John Updated"<br>Role: "Admin" | User details updated.<br>Success notification.<br>List reflects new name/role. | | | |
| **TC-User-Alloc-001** | Edit Storage Allocation | 1. Edit User<br>2. Adjust "Storage Limit" slider or input<br>3. Click "Save" | Limit: 10GB | User storage quota updated.<br>User dashboard (when logged in as that user) reflects new limit. | | | |
| **TC-User-Pass-001** | Admin Reset Password | 1. Edit User<br>2. Click "Reset Password" (if available) or enter new password in blank field<br>3. Click "Save" | New Pass: "NewSecurePass!" | Password updated.<br>Old password no longer works for that user. | | | |
| **TC-User-Delete-001** | Delete User (Success) | 1. Find user in list<br>2. Click "Delete" (Trash icon)<br>3. READ Confirmation Dialog<br>4. Click "Confirm Delete" | | User is permanently removed.<br>Success notification.<br>User no longer in list.<br>Associated files are deleted (checks backend). | | | |
| **TC-User-Delete-002** | Cancel Delete | 1. Click "Delete"<br>2. Click "Cancel" in confirmation dialog | | Dialog closes.<br>User REMAINS in the list. | | | |
| **TC-User-Access-001** | Non-Admin Access Denied | 1. Log in as NON-ADMIN user<br>2. Attempt to navigate to "Users" page (via URL or UI if visible) | URL: /users.html | Access denied.<br>Redirected to Dashboard or 403 Error page shown.<br>"Users" link is hidden in sidebar. | | | |
