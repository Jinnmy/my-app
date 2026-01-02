Test Scenario | Video Player (Streaming) | Test Case Description | User streams Video content from storage and vault
--- | --- | --- | ---
**Pre-condition** | User logged in. Valid Video files exist in storage. | **Post-condition** | Video plays smoothy with audio.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Video-Stream-001** | Stream Video (Standard) | 1. Double-click a video file (mp4, webm) | | Video player overlay/modal opens.<br>Video starts playing automatically.<br>Audio is audible. | | | |
| **TC-Video-Controls-001** | Player Controls | 1. Play video<br>2. Pause<br>3. Seek (drag timeline)<br>4. Volume Control | | Video responds to all controls instantly.<br>Buffering is minimal. | | | |
| **TC-Video-Unsupported-001** | Unsupported Format | 1. Attempt to open unsupported video format (e.g. .avi directly in browser without transcode) | | System prompts to Download file instead OR displays "Format not supported" error. | | | |
| **TC-Video-Vault-001** | Stream Encrypted Video | 1. Open video from INSIDE unlocked Vault | | Video streams normally (on-the-fly decryption).<br>No "file corrupted" errors. | | | |
