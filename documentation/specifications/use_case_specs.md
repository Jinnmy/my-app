# NAS 2.0 Use Case Specifications

This document details the functional use cases for the NAS 2.0 application, derived from the system use case diagram.

## 1. Authentication Module

### UC_Login: Login
- **Actor**: User, Admin
- **Description**: Allows a registered user to authenticate with the system.
- **Preconditions**: Application is initialized; specific internal IP range if configured.
- **Postconditions**: User is authenticated and redirected to the dashboard.
- **Alternate Flow**:
    - *Forgot Password*: User clicks "Forgot Password" > Enters Email > System sends reset link.
- **Exception Flow**:
    - *Invalid Credentials*: User enters wrong password > System displays "Invalid username or password" > User retries.
    - *Account Locked*: User exceeds max login attempts > System locks account for 15 minutes.

### UC_Logout: Logout
- **Actor**: User, Admin
- **Description**: Terminates the user's session.
- **Preconditions**: User is logged in.
- **Postconditions**: Session is destroyed; User redirected to Login page.
- **Alternate Flow**:
    - *Auto-Logout*: Session expires due to inactivity > System logs user out automatically.
- **Exception Flow**:
    - *Network Error*: Request fails > Client-side cleanup ensures local session is cleared.

### UC_Setup: Initial Setup
- **Actor**: Admin (First Run)
- **Description**: Configures the initial admin account and system settings on the very first launch.
- **Preconditions**: Database is empty/unconfigured.
- **Postconditions**: Admin account created; System marked as configured.
- **Exception Flow**:
    - *Already Configured*: User accesses setup page after config > Redirects strictly to Login page.
    - *Write Failure*: Config file not writable > System displays "Permission Error".

### UC_StorageMgmt: Storage Management
- **Actor**: Admin
- **Description**: Configure physical disks, create storage pools, and manage RAID settings.
- **Preconditions**: Admin is logged in; Physical disks are connected.
- **Postconditions**: Storage pool created; RAID volume formatted and mounted.
- **Flow**: Admin views Disks > Selects RAID Level (Simple/Mirror/Parity) > Selects Disks > Clicks "Configure" > System formats and pools disks.
- **Exception Flow**:
    - *Disk In Use*: Selected disk is not empty > System attempts to clear or prompts for manual clearance.
    - *Script Error*: PowerShell execution fails > System logs error and alerts admin.

---

## 2. File Management Module

### UC_Upload: Upload Files
- **Actor**: User
- **Description**: Upload files or folders to the NAS storage.
- **Preconditions**: User is logged in; Sufficient storage quota available.
- **Postconditions**: File is saved to disk; Database entry created; Quota updated.
- **Flow**: User selects files > System processes upload > Updates database.
- **Alternate Flow**:
    - *Duplicate File*: File with same name exists > System prompts (Overwrite/Rename/Skip) > User selects option > System executes.
- **Exception Flow**:
    - *Storage Full*: System detects insufficient space > Aborts upload > Displays "Storage Quota Exceeded".
    - *Network Failure*: Connection lost during upload > System pauses/fails > User can retry failed items.

### UC_Download: Download Files
- **Actor**: User
- **Description**: Retrieve files from the NAS to the local device.
- **Preconditions**: User is logged in; File exists and user has read permission.
- **Postconditions**: File is transferred to the user's local device.
- **Alternate Flow**:
    - *Multi-Select*: User selects multiple files > System zips them > User downloads ZIP.
- **Exception Flow**:
    - *File Not Found*: File deleted by another user > System updates view > Alert "File no longer exists".
    - *Network Interrupt*: Download cuts off > Browser manages resume (if supported) or fail.

### UC_Search: Search Files
- **Actor**: User
- **Description**: Search for files by name, extension, or tag.
- **Preconditions**: User is logged in.
- **Postconditions**: List of files matching criteria is displayed.
- **Flow**: User types query > System filters results > Displays matches.
- **Alternate Flow**:
    - *No Results*: User query matches nothing > System displays "No files found" message.
    - *Filter by Tag*: User clicks a tag > System filters file list by that tag.

### UC_Del: Delete/Restore Files
- **Actor**: User
- **Description**: Move files to trash or permanently delete them; restore from trash.
- **Preconditions**: User is logged in; Target file exists; User has write permission.
- **Postconditions**: File status updated to 'deleted' (soft delete) or removed from DB/Disk (permanent).
- **Alternate Flow**:
    - *Empty Trash*: User clicks "Empty Trash" > System deletes all files in trash permanently > Updates Quota.
    - *Restore*: User selects file in Trash > Clicks Restore > File moves back to original path.
- **Exception Flow**:
    - *File Locked*: User tries to delete file in use/locked > System denies action.

### UC_Share: Share Links
- **Actor**: User
- **Description**: Generate public or time-limited links for files to share with external users.
- **Preconditions**: User is logged in; File exists.
- **Postconditions**: Share link generated and active until expiration.
- **Alternate Flow**:
    - *Expire Link*: User sets custom expiry date > Link becomes invalid after date.
- **Exception Flow**:
    - *Link Revoked*: Admin/User deletes share link > External user sees "Link Expired/Invalid".

### UC_Meta: Edit Metadata/Tags
- **Actor**: User
- **Description**: Modify file descriptions or add searchable tags (manual or AI-generated).
- **Preconditions**: User is logged in; File exists.
- **Postconditions**: File metadata updated in database.
- **Alternate Flow**:
    - *Auto-Tag*: User clicks "AI Tag" > System analyzes file > Appends generated tags.
- **Exception Flow**:
    - *Save Fail*: Database busy/error > System alerts "Could not save metadata".

### UC_View: View/Stream Media
- **Actor**: User
- **Description**: Preview images or stream video/audio content directly in the browser.
- **Preconditions**: User is logged in; File format supported by browser.
- **Postconditions**: Content is displayed or played in the viewer.
- **Alternate Flow**:
    - *Slideshow*: User opens image in folder > Clicks "Slideshow" > System cycles images.
- **Exception Flow**:
    - *Codec Unsupport*: File format not supported by browser > System prompts "Download to view".

### UC_docx: View/Edit Document
- **Actor**: User
- **Description**: Open and edit Microsoft Word (.docx) or text documents within the application.
- **Preconditions**: User is logged in; Supported document type.
- **Postconditions**: Document loaded in editor; Changes saved to disk on save.
- **Flow**: User clicks doc > Editor loads content > User edits > Autosave/Manual Save.
- **Exception Flow**:
    - *Conversion Error*: Complex formatting fails to render in web editor > System shows plaintext fallback.

### UC_pdf: View PDF
- **Actor**: User
- **Description**: Preview PDF files directly in the browser.
- **Preconditions**: User is logged in; Valid PDF file.
- **Postconditions**: PDF content rendered in viewer.
- **Exception Flow**:
    - *Corrupt File*: PDF header invalid > Viewer displays "Cannot load PDF".

---

## 3. Personal Vault Module

### UC_VaultSetup: Setup Vault
- **Actor**: User
- **Description**: Initialize the personal vault by setting a password.
- **Preconditions**: User is logged in; Vault not yet configured.
- **Postconditions**: Vault password hash stored; Vault enabled flag set.
- **Exception Flow**:
    - *Weak Password*: Password complexity check fails > System requires stronger password.
    - *Vault Exists*: Vault already set up > System prompts to "Reset Vault" (wiping data) instead.

### UC_VaultLock: Encrypted File Access
- **Actor**: User
- **Description**: Access files stored in the encrypted vault.
- **Preconditions**: User is logged in; Vault is enabled.
- **Postconditions**: Vault unlocked for session; Files visible.
- **Flow**: User requests access > Enters Password > System decrypts view > Session times out.
- **Alternate Flow**:
    - *Manual Lock*: User clicks "Lock Vault" > System immediately hides content and destroys session key.
- **Exception Flow**:
    - *Session Timeout*: User inactive for N minutes > System auto-locks vault > Prompt password on next action.
    - *Max Attempts Exceeded*: Multiple failed password entries > System temporarily disables vault access.

---

## 4. Settings & Preferences

### UC_Prefs: Manage Preferences
- **Actor**: User
- **Description**: internal settings like language, theme, or notification preferences.
- **Preconditions**: User is logged in.
- **Postconditions**: Settings updated in database; UI reflects new preferences.
- **Alternate Flow**:
    - *Reset Defaults*: User clicks "Reset to Defaults" > System restores standard settings.

### UC_Profile: Update Profile
- **Actor**: User
- **Description**: Update user details like password or avatar.
- **Preconditions**: User is logged in.
- **Postconditions**: User profile updated in database.
- **Exception Flow**:
    - *Validation Fail*: Invalid email format or mismatched passwords > Form validation error.

---

## 5. Administration Module

### Use case 16: Create user
- **Actor**: Admin
- **Description**: Create a new user account with specific roles and quota.
- **Preconditions**: Admin is logged in.
- **Postconditions**: New user created in database.
- **Flow**: Admin navigates to User Management > Clicks "Create User" > Enters details (Username, Email, Role, Quota) > Clicks "Save" > System creates user.
- **Exception Flow**:
    - *User Exists*: Creating user with existing email > System flags duplicate.

### Use case 17: Edit user
- **Actor**: Admin
- **Description**: Modify existing user details, password, roles, or permissions.
- **Preconditions**: Admin is logged in; User exists.
- **Postconditions**: User record updated in database.
- **Flow**: Admin selects user from list > Clicks "Edit" > Updates details > Clicks "Save Updates" > System validates and commits changes.
- **Exception Flow**:
    - *Validation Fail*: Invalid email or password requirements not met > System shows error.

### Use case 18: Delete user
- **Actor**: Admin
- **Description**: Remove a user account from the system.
- **Preconditions**: Admin is logged in; User exists.
- **Postconditions**: User record deleted from database.
- **Flow**: Admin clicks "Delete" on user row > System requests confirmation > Admin confirms > System removes user.
- **Alternate Flow**:
    - *Keep Files*: Admin chooses to transfer user files to another account before deletion.
    - *Delete Files*: Admin chooses to delete user's files permanently.

### Use case 19: Allocate unmarked files
- **Actor**: Admin
- **Description**: Scan the disk for orphaned files (not in DB) and assign them to a specific user.
- **Preconditions**: Admin is logged in.
- **Postconditions**: Files registered in database under target user; Storage usage updated.
- **Flow**: Admin navigates to Storage Tools > Clicks "Scan for Unmarked" > Selects files from result list > Assigns to a User > Clicks "Allocate".
- **Alternate Flow**:
    - *No Files*: Scan completes with 0 results > System shows "No unmarked files found".
- **Exception Flow**:
    - *Permission Denied*: System cannot read a detected file > Skips file > Adds entry to error log.

### Use case 20: Manage AI features
- **Actor**: Admin
- **Description**: Manage AI capabilities such as downloading or offloading local AI models (e.g., BLIP, Flan-T5) used for image captioning or other features.
- **Preconditions**: Admin is logged in; Internet connection (for download).
- **Postconditions**: AI features enabled/models downloaded or disabled/offloaded.
- **Flow**: Admin views AI Settings > Checks model status > Clicks "Download" or "Offload" > System performs background operation > Updates status.
- **Alternate Flow**:
    - *Download Models*: Admin clicks "Download Models" > System fetches/extracts python env and models.
    - *Offload Models*: Admin clicks "Offload Models" > System deletes model files to free space.
- **Exception Flow**:
    - *Download Fail*: Network error or disk full during download > System reports failure.

### Use case 21: Reset System
- **Actor**: Admin
- **Description**: Wipe the database and restore the system to a clean slate (files may be preserved depending on config).
- **Preconditions**: Admin is logged in.
- **Postconditions**: Database wiped/re-initialized; System restarted.
- **Flow**: Admin requests reset > Confirms warning > Inputs Admin Password > System wipes DB > Restarts.
- **Exception Flow**:
    - *Incorrect Password*: Admin fails confirmation auth > Reset aborted.
