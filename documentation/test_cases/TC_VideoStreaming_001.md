Test Scenario | Video Player (Streaming) | Test Case Description | User streams Video content from storage and vault
--- | --- | --- | ---
**Pre-condition** | User logged in. Valid Video files exist in storage. | **Post-condition** | Video plays smoothy with audio.

| Test Case ID | Objective | Action | Input | Expected Output | Actual Output | Test Result (Pass/Fail) | Test Comments |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **TC-Video-Stream-001** | Stream Video (Standard) | 1. Double-click a native video file (mp4, webm) | | Video player overlay/modal opens.<br>Video starts playing automatically.<br>Audio is audible. | | | |
| **TC-Video-Transcode-001** | Stream Transcoded Video | 1. Double-click a non-native video file (mkv, avi) | | System detects non-native format.<br>Video streams via FFmpeg transcoding (may have slight load time).<br>Video plays smoothly. | | | |
| **TC-Video-Controls-001** | Player Controls | 1. Play video<br>2. Pause<br>3. Seek (drag timeline)<br>4. Volume Control | | Video responds to all controls instantly.<br>Buffering is minimal. | | | |
| **TC-Video-Seek-001** | Seek Large Video (Range) | 1. Open large video (>100MB)<br>2. Jump to 50%<br>3. Jump to 90% | | Playback resumes quickly from selected timestamp.<br>No "Content Length" errors. | | | |
| **TC-Video-Unsupported-001** | Unsupported/Corrupt File | 1. Attempt to open a file with unknown extension or corrupt data | | System displays error: "Format not supported" or fails gracefully.<br>Player does not crash. | | | |
| **TC-Video-Vault-001** | Stream Encrypted Video | 1. Open video from INSIDE unlocked Vault | | Video streams normally (on-the-fly decryption).<br>No "file corrupted" errors. | | | |
