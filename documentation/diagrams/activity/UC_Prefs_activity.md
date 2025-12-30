# Activity Diagram: UC_Prefs (Manage Preferences)

```mermaid
graph TD
    Start((Start)) --> UserAction1

    subgraph User [User]
        UserAction1[Navigate to Settings]
        UserAction2[Modify Options (Theme/Lang/etc)]
        UserAction3[Click 'Save']
        UserAction4[Click 'Reset to Defaults']
    end

    subgraph System [System]
        SysAction1[Load Current Preferences]
        SysAction2[Display Settings Form]
        SysAction3[Validate Input]
        SysAction4[Update Database]
        SysAction5[Refresh UI State]
        SysAction6[Restore Default Values]
    end

    UserAction1 --> SysAction1
    SysAction1 --> SysAction2
    SysAction2 --> UserAction2
    
    %% Save Flow
    UserAction2 --> UserAction3
    UserAction3 --> SysAction3
    SysAction3 --> SysAction4
    SysAction4 --> SysAction5

    %% Reset Flow
    UserAction4 --> SysAction6
    SysAction6 --> SysAction4

    SysAction5 --> End((End))
```
