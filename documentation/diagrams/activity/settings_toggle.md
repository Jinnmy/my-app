# Settings Management

This diagram illustrates enabling or disabling application settings (e.g., Theme, Notifications, Tray behavior).

```mermaid
flowchart TD
    Start([User Opens Settings]) --> View[Render Settings List]
    View --> Change[User Toggles a Setting]
    
    Change --> API[Call Update Preferences API]
    
    subgraph Persistence
        API --> LoadUser[Load User Profile]
        LoadUser --> UpdateJson[Update Preferences JSON/Column]
        UpdateJson --> Save[Save to DB]
    end
    
    Save --> Success[Return Success]
    Success --> Apply[Apply Setting Immediately (Frontend)]
    
    Apply --> Toast([Show Saved Notification])
```
